-- Import legacy seller tickets that were previously encoded in AuditLog JSON.
-- AuditLog rows are intentionally retained for forensic continuity.
INSERT INTO "SupportTicket" (
  "id", "reference", "source", "category", "subject", "status", "priority",
  "requesterName", "requesterEmail", "sellerId", "createdById", "lastMessageAt",
  "createdAt", "updatedAt"
)
SELECT
  'legacy-' || a."id",
  COALESCE(NULLIF(a."entityId", ''), 'LEGACY-' || UPPER(SUBSTRING(a."id" FROM 1 FOR 8))),
  'SELLER'::"SupportTicketSource",
  COALESCE(NULLIF(a."details"->>'category', ''), 'Autre'),
  COALESCE(NULLIF(a."details"->>'subject', ''), 'Demande d’assistance'),
  'OPEN'::"SupportTicketStatus",
  'NORMAL'::"SupportTicketPriority",
  COALESCE(NULLIF(u."name", ''), NULLIF(s."storeName", ''), 'Vendeur MandeMarket'),
  COALESCE(NULLIF(u."email", ''), 'vendeur-inconnu@mandemarket.invalid'),
  s."id",
  a."userId",
  a."createdAt",
  a."createdAt",
  a."createdAt"
FROM "AuditLog" a
LEFT JOIN "User" u ON u."id" = a."userId"
LEFT JOIN "Seller" s ON s."userId" = a."userId"
WHERE a."entity" = 'SupportTicket'
  AND a."action" = 'SUPPORT_TICKET_CREATED'
  AND COALESCE(NULLIF(a."details"->>'message', ''), '') <> ''
ON CONFLICT ("reference") DO NOTHING;

INSERT INTO "SupportMessage" (
  "id", "ticketId", "authorId", "sender", "authorName", "message", "internal", "createdAt", "updatedAt"
)
SELECT
  'legacy-message-' || a."id",
  t."id",
  a."userId",
  'REQUESTER'::"SupportMessageSender",
  COALESCE(NULLIF(u."name", ''), NULLIF(s."storeName", ''), 'Vendeur MandeMarket'),
  a."details"->>'message',
  false,
  a."createdAt",
  a."createdAt"
FROM "AuditLog" a
JOIN "SupportTicket" t ON t."id" = 'legacy-' || a."id"
LEFT JOIN "User" u ON u."id" = a."userId"
LEFT JOIN "Seller" s ON s."userId" = a."userId"
WHERE a."entity" = 'SupportTicket'
  AND a."action" = 'SUPPORT_TICKET_CREATED'
  AND COALESCE(NULLIF(a."details"->>'message', ''), '') <> ''
ON CONFLICT ("id") DO NOTHING;
