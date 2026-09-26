"""Browser acceptance against an explicitly isolated localhost deployment.

No PSP, real customer, SMTP relay or production host is permitted. The browser
accepts the disposable TLS certificate; Node still validates SMTP STARTTLS with
the generated CA. This is not a validation of public certificates or PSP contracts.
"""
import html
import json
import os
from pathlib import Path
import re
import time
import unittest
import urllib.request
from datetime import datetime, timezone
from playwright.sync_api import sync_playwright, expect

BASE = "https://localhost:3443"
MAIL = "http://127.0.0.1:8025"
OUT = Path("qa-results")
OUT.mkdir(exist_ok=True)
PASSWORD = os.environ.get("E2E_PASSWORD", "")
OPS_TOKEN = os.environ.get("CI_METRICS_TOKEN", "")
if len(PASSWORD) < 16:
    raise RuntimeError("E2E_PASSWORD must be generated for this isolated run")
if len(OPS_TOKEN) < 32:
    raise RuntimeError("CI_METRICS_TOKEN must be generated for this isolated run")
TOKEN_KEY = "mandemarket_customer_token"
EXTERNAL = re.compile(r"^https?://(?!localhost:3443(?:/|$))")


def mail_received(address, subject_fragment):
    until = time.monotonic() + 30
    while time.monotonic() < until:
        with urllib.request.urlopen(MAIL + "/api/v1/messages", timeout=5) as response:
            messages = json.load(response).get("messages", [])
        for message in messages:
            recipients = message.get("To", [])
            if any(recipient.get("Address") == address for recipient in recipients) and subject_fragment.lower() in message.get("Subject", "").lower():
                return True
        time.sleep(0.25)
    return False


def mail_link(address, path):
    """Read an actual SMTP-captured message, never a token from the database."""
    until = time.monotonic() + 30
    while time.monotonic() < until:
        with urllib.request.urlopen(MAIL + "/api/v1/messages", timeout=5) as response:
            messages = json.load(response).get("messages", [])
        for message in messages:
            if not any(recipient.get("Address") == address for recipient in message.get("To", [])):
                continue
            with urllib.request.urlopen(MAIL + "/api/v1/message/" + message["ID"], timeout=5) as response:
                content = json.load(response)
            for link in re.findall(r'href=[\"\']([^\"\']+)', content.get("HTML", "")):
                link = html.unescape(link)
                if link.startswith(BASE + path) and "#token=" in link:
                    return link
        time.sleep(0.25)
    raise AssertionError("Expected SMTP message/link was not delivered for " + path)


class BrowserAcceptance(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pw = sync_playwright().start()
        cls.chromium = cls.pw.chromium.launch()
        cls.webkit = cls.pw.webkit.launch()

    @classmethod
    def tearDownClass(cls):
        cls.chromium.close()
        cls.webkit.close()
        cls.pw.stop()

    def setUp(self):
        mobile = "mobile" in self._testMethodName
        engine = self.webkit if "webkit" in self._testMethodName else self.chromium
        opts = dict(self.pw.devices["iPhone 13"]) if mobile else {"viewport": {"width": 1440, "height": 1000}}
        opts.pop("default_browser_type", None)
        self.context = engine.new_context(**opts, ignore_https_errors=True, locale="fr-FR")
        self.page = self.context.new_page()
        self.page.set_default_timeout(15000)
        self.errors = []
        self.page.on("pageerror", lambda error: self.errors.append(str(error)))
        self.page.on("response", lambda response: self.errors.append(f"HTTP {response.status} {response.url.split(chr(63))[0]}") if response.url.startswith(BASE + "/api/") and response.status >= 500 else None)
        self.context.route(EXTERNAL, lambda route: route.abort())
        self.context.tracing.start(screenshots=True, snapshots=True)

    def tearDown(self):
        name = self._testMethodName
        try:
            self.page.screenshot(path=str(OUT / (name + ".png")), full_page=True)
            self.context.tracing.stop(path=str(OUT / (name + ".zip")))
        finally:
            self.context.close()
        self.assertEqual(self.errors, [], "Unhandled browser JavaScript errors")

    def api(self, path, token=None, method="GET", data=None, headers=None):
        headers = dict(headers or {})
        if token:
            headers["Authorization"] = "Bearer " + token
        return self.context.request.fetch(BASE + path, method=method, headers=headers, data=data)

    def login(self, email, password, staff=False, expected_path=None):
        self.page.goto(BASE + ("/admin/login" if staff else "/compte/login"))
        login_button = self.page.get_by_role("button", name="Se connecter", exact=True)
        expect(login_button).to_be_visible()
        # During client auth hydration the newsletter form is rendered before the
        # login form. Select the form that owns the login button, never ".first".
        form = self.page.locator("form").filter(has=login_button)
        form.locator('input[type="email"]').fill(email)
        form.locator('input[type="password"]').fill(password)
        login_button.click()
        target = expected_path or ("/vendeur/dashboard" if email == "qa-seller@test.invalid" else "/admin/dashboard" if staff else "/compte/dashboard")
        expect(self.page).to_have_url(re.compile(re.escape(BASE + target)))
        key = "admin_token" if staff else TOKEN_KEY
        self.page.wait_for_function("key => !!localStorage.getItem(key)", arg=key)
        return self.page.evaluate("key => localStorage.getItem(key)", key)

    def add_to_cart(self):
        self.page.goto(BASE + "/boutique/1")
        expect(self.page.get_by_role("heading", name="Article recette QA", exact=True)).to_be_visible()
        self.page.get_by_role("button", name=re.compile("Ajouter au panier", re.I)).click()
        self.page.wait_for_function("JSON.parse(localStorage.getItem('mandemarket_cart') || '[]').length > 0")
        self.page.goto(BASE + "/checkout")
        expect(self.page.get_by_role("heading", name="Finaliser la commande")).to_be_visible()
        expect(self.page.get_by_role("button", name="Confirmer la commande")).to_be_enabled()
        expect(self.page.get_by_test_id("quote-total")).to_have_attribute("data-amount", "2200000")

    def test_01_verified_registration_recovery_and_revocation(self):
        email = "qa-registration@test.invalid"
        self.page.goto(BASE + "/compte/register")
        for name, value in {"firstName": "Recette", "lastName": "Navigateur", "email": email,
                            "password": PASSWORD, "confirmPassword": PASSWORD}.items():
            self.page.locator('input[name="' + name + '"]').fill(value)
        self.page.get_by_role("button", name="Créer mon compte", exact=True).click()
        expect(self.page).to_have_url(BASE + "/compte/verifier-email")
        self.assertIsNone(self.page.evaluate("key => localStorage.getItem(key)", TOKEN_KEY))
        denied = self.api("/api/account/login", method="POST", data={"email": email, "password": PASSWORD})
        self.assertEqual(denied.status, 403)
        self.page.goto(mail_link(email, "/compte/verifier-email"))
        verified_password = PASSWORD + "v"
        self.page.get_by_label("Nouveau mot de passe").fill(verified_password)
        self.page.get_by_role("button", name="Confirmer", exact=True).click()
        expect(self.page.get_by_role("status")).to_contain_text("Adresse verifiee")
        token = self.login(email, verified_password)
        self.assertEqual(self.api("/api/account/me", token).status, 200)
        cookies = [c for c in self.context.cookies() if c["name"] == "mm_refresh_customer"]
        self.assertEqual(len(cookies), 1)
        self.assertTrue(cookies[0]["httpOnly"] and cookies[0]["secure"])
        self.assertEqual(cookies[0]["sameSite"], "Lax")
        # Exercise renewal with a real refresh cookie, without waiting 15 minutes.
        self.page.evaluate("key => localStorage.setItem(key, 'invalid.expired.token')", TOKEN_KEY)
        self.page.reload()
        self.page.wait_for_function("key => { const t=localStorage.getItem(key); return t && t !== 'invalid.expired.token'; }", arg=TOKEN_KEY)
        active = self.page.evaluate("key => localStorage.getItem(key)", TOKEN_KEY)
        self.assertEqual(self.api("/api/account/me", active).status, 200)
        self.page.get_by_role("button", name=re.compile("Se d.connecter", re.I)).first.click()
        self.page.wait_for_function("key => !localStorage.getItem(key)", arg=TOKEN_KEY)
        self.assertEqual(self.api("/api/account/me", active).status, 401)
        self.page.goto(BASE + "/compte/mot-de-passe-oublie")
        self.page.get_by_label("Email", exact=True).fill(email)
        self.page.get_by_role("button", name="Envoyer le lien").click()
        expect(self.page.get_by_role("status")).not_to_be_empty()
        self.page.goto(mail_link(email, "/compte/reinitialiser-mot-de-passe"))
        reset_password = PASSWORD + "r"
        self.page.get_by_label("Nouveau mot de passe").fill(reset_password)
        self.page.get_by_role("button", name="Confirmer", exact=True).click()
        expect(self.page.get_by_role("status")).not_to_be_empty()
        self.assertEqual(self.api("/api/account/login", method="POST", data={"email": email, "password": verified_password}).status, 401)
        self.login(email, reset_password)

    def test_02_mobile_guest_checkout_quote_and_email_capability(self):
        self.add_to_cart()
        self.page.locator('input[name="shippingOptionId"][value="EXPRESS"]').check()
        expect(self.page.get_by_test_id("quote-total")).to_have_attribute("data-amount", "2400000")
        for name, value in {"firstName": "Invite", "lastName": "Mobile", "email": "qa-guest@test.invalid", "street": "Rue fictive QA"}.items():
            self.page.locator('input[name="' + name + '"]').fill(value)
        self.page.locator('select[name="commune"]').select_option("Cocody")
        self.page.locator('input[name="paymentMethod"][value="cash_on_delivery"]').check()
        with self.page.expect_response(lambda response: response.url.endswith("/api/orders/checkout") and response.request.method == "POST") as created:
            self.page.get_by_role("button", name="Confirmer la commande").click()
        response = created.value
        self.assertEqual(response.status, 201)
        data = response.json()
        self.assertEqual(data["totalAmount"], 2400000)
        self.assertEqual(data["order"]["shipping"]["method"], "EXPRESS")
        expect(self.page).to_have_url(re.compile(re.escape(BASE + "/commande/")))
        expect(self.page.get_by_role("heading", name=re.compile("Commande enregistr.e"))).to_be_visible()
        reference = data["orderNumber"]
        self.assertEqual(self.api("/api/orders/reference/" + reference).status, 404)
        link = mail_link("qa-guest@test.invalid", "/commande/")
        other = self.chromium.new_context(ignore_https_errors=True)
        other.route(EXTERNAL, lambda route: route.abort())
        try:
            page = other.new_page()
            page.goto(link)
            expect(page.get_by_role("heading", name=re.compile("Commande enregistr.e"))).to_be_visible()
            self.assertNotIn("#token=", page.url)
        finally:
            other.close()

    def test_03_mobile_unavailable_country_blocks_stale_quote(self):
        self.add_to_cart()
        self.page.locator('select[name="countryCode"]').select_option("NG")
        expect(self.page.locator("p[role=alert]")).to_contain_text("Livraison indisponible")
        expect(self.page.get_by_role("button", name="Confirmer la commande")).to_be_disabled()
        expect(self.page.get_by_test_id("quote-total")).to_have_attribute("data-amount", "")

    def test_04_inaccessible_order_never_shows_success(self):
        self.page.goto(BASE + "/commande/00000000-0000-4000-8000-000000000000")
        expect(self.page.get_by_role("heading", name="Commande inaccessible")).to_be_visible()
        expect(self.page.get_by_role("heading", name=re.compile("Commande confirm.e"))).to_have_count(0)

    def test_05_admin_and_seller_permissions(self):
        token = self.login("qa-admin@test.invalid", PASSWORD, staff=True)
        self.assertEqual(self.api("/api/admin/refunds", token).status, 200)
        self.assertEqual(self.api("/api/auth/logout", token, method="POST").status, 200)
        self.page.evaluate("localStorage.clear()")
        token = self.login("qa-seller@test.invalid", PASSWORD, staff=True)
        self.assertEqual(self.api("/api/admin/refunds", token).status, 403)
        expect(self.page.get_by_text("QA Boutique", exact=True).first).to_be_visible()

    def test_06_webkit_public_catalog_and_cart(self):
        self.add_to_cart()
        self.page.goto(BASE + "/panier")
        expect(self.page.get_by_text("Article recette QA", exact=True).first).to_be_visible()
        self.page.wait_for_load_state("networkidle")
        self.page.reload()
        expect(self.page.get_by_text("Article recette QA", exact=True).first).to_be_visible()

    def test_07_security_headers_and_internal_metrics(self):
        response = self.context.request.get(BASE + "/")
        self.assertEqual(response.status, 200)
        headers = response.headers
        csp = headers.get("content-security-policy", "")
        self.assertIn("frame-ancestors 'none'", csp)
        self.assertIn("object-src 'none'", csp)
        self.assertIn("max-age=", headers.get("strict-transport-security", ""))
        self.assertEqual(headers.get("x-content-type-options"), "nosniff")

        denied = self.api("/api/internal/metrics")
        self.assertEqual(denied.status, 404)
        metrics = self.api("/api/internal/metrics", headers={"Authorization": "Bearer " + OPS_TOKEN})
        self.assertEqual(metrics.status, 200)
        body = metrics.text()
        self.assertIn("mandemarket_http_requests_total", body)
        self.assertIn("mandemarket_http_request_duration_seconds", body)

    def test_08_seller_catalog_management(self):
        token = self.login("qa-seller@test.invalid", PASSWORD, staff=True)
        self.page.goto(BASE + "/vendeur/dashboard/produits")
        expect(self.page.get_by_role("heading", name="Tous les produits")).to_be_visible()
        expect(self.page.get_by_text("Article recette QA", exact=True).first).to_be_visible()

        self.page.get_by_role("button", name="Dupliquer").first.click()
        expect(self.page.get_by_text(re.compile("Produit dupliqu.*succ", re.I))).to_be_visible()

        products = self.api("/api/sellers/me/products?limit=50", token)
        self.assertEqual(products.status, 200)
        data = products.json()["products"]
        original = next(product for product in data if product["name"] == "Article recette QA")
        self.assertTrue(any(product["name"].startswith("[Copie]") for product in data))

        stock = self.api(
            f"/api/sellers/me/products/{original['id']}/stock",
            token,
            method="PUT",
            data={"quantity": 7, "lowStockThreshold": 5},
        )
        self.assertEqual(stock.status, 200)
        self.assertEqual(stock.json()["stock"], 7)

        promo = self.api("/api/sellers/me/promotions", token, method="POST",
                         data={"code": "QA10", "name": "QA 10%", "type": "PERCENTAGE", "value": 10, "minAmount": 0, "maxUses": 20})
        self.assertEqual(promo.status, 201)
        listed = self.api("/api/sellers/me/promotions", token)
        self.assertEqual(listed.status, 200)
        self.assertTrue(any(item["code"] == "QA10" for item in listed.json()))

        message = self.api("/api/sellers/me/messages/send", token, method="POST",
                           data={"customerEmail": "qa-guest@test.invalid", "subject": "Suivi QA vendeur",
                                 "content": "Votre commande de recette est bien prise en charge."})
        self.assertEqual(message.status, 200)
        self.assertTrue(mail_received("qa-guest@test.invalid", "Suivi QA vendeur"))

        team = self.api("/api/sellers/me/team", token)
        self.assertEqual(team.status, 200)
        invite = self.api("/api/sellers/me/team/invite", token, method="POST",
                          data={"email": "collab@test.invalid", "role": "manager"})
        self.assertEqual(invite.status, 501)

    def test_09_admin_marketplace_and_audit(self):
        token = self.login("qa-admin@test.invalid", PASSWORD, staff=True)
        sellers = self.api("/api/sellers/admin/all", token)
        self.assertEqual(sellers.status, 200)
        payload = sellers.json()
        seller_list = payload if isinstance(payload, list) else payload.get("sellers", [])
        self.assertTrue(any(seller.get("storeName") == "QA Boutique" for seller in seller_list))

        audit = self.api("/api/admin/audit-logs?page=1&limit=10", token)
        self.assertEqual(audit.status, 200)
        self.page.goto(BASE + "/admin/dashboard")
        expect(self.page.get_by_text("MandeMarket", exact=True).first).to_be_visible()

    def test_10_verified_review_requires_authenticated_customer(self):
        catalog = self.api("/api/products?search=Article%20recette%20QA")
        self.assertEqual(catalog.status, 200)
        product_id = catalog.json()["products"][0]["id"]

        spoof = self.api(
            "/api/reviews",
            method="POST",
            data={
                "productId": product_id,
                "customerName": "Usurpateur",
                "customerEmail": "qa-buyer@test.invalid",
                "rating": 1,
                "title": "Tentative",
                "comment": "Cet avis ne doit jamais obtenir le badge achat vérifié.",
            },
        )
        self.assertEqual(spoof.status, 201)
        self.assertFalse(spoof.json()["review"]["isVerified"])
        self.assertEqual(spoof.json()["review"]["status"], "pending")

        buyer_token = self.login("qa-buyer@test.invalid", PASSWORD)
        verified = self.api(
            "/api/reviews",
            buyer_token,
            method="POST",
            data={
                "productId": product_id,
                "customerName": "Nom falsifié",
                "customerEmail": "attacker@test.invalid",
                "rating": 5,
                "title": "Achat réel",
                "comment": "Avis authentifié issu du compte réellement livré.",
            },
        )
        self.assertEqual(verified.status, 201)
        review = verified.json()["review"]
        self.assertTrue(review["isVerified"])
        self.assertEqual(review["status"], "approved")
        self.assertEqual(review["customerName"], "QA Buyer")
        self.assertEqual(review["customerEmail"], "qa-buyer@test.invalid")

        duplicate = self.api(
            "/api/reviews",
            buyer_token,
            method="POST",
            data={"productId": product_id, "customerName": "QA", "rating": 4, "comment": "Doublon"},
        )
        self.assertEqual(duplicate.status, 409)

        self.page.evaluate("localStorage.clear()")
        seller_token = self.login("qa-seller@test.invalid", PASSWORD, staff=True)
        reply = self.api(
            f"/api/sellers/me/reviews/{review['id']}/reply",
            seller_token,
            method="POST",
            data={"reply": "Merci pour votre retour vérifié."},
        )
        self.assertEqual(reply.status, 200)
        self.assertEqual(reply.json()["review"]["sellerReply"], "Merci pour votre retour vérifié.")

        public_reviews = self.api(f"/api/reviews/{product_id}")
        self.assertEqual(public_reviews.status, 200)
        visible = public_reviews.json()["reviews"]
        self.assertEqual(len([item for item in visible if item["id"] == review["id"]]), 1)
        published = next(item for item in visible if item["id"] == review["id"])
        self.assertTrue(published["isVerified"])
        self.assertEqual(published["sellerReply"], "Merci pour votre retour vérifié.")
        self.assertFalse(any(item["id"] == spoof.json()["review"]["id"] for item in visible))


    def test_11_seller_onboarding_email_approval_and_access(self):
        email = "qa-new-seller@test.invalid"
        self.page.goto(BASE + "/devenir-vendeur")
        self.page.get_by_role("button", name=re.compile("Créer ma boutique gratuitement", re.I)).click()
        self.page.locator('input[name="name"]').fill("Nouveau Vendeur QA")
        self.page.locator('input[name="email"]').fill(email)
        self.page.locator('input[name="password"]').fill(PASSWORD)
        self.page.locator('input[name="storeName"]').fill("Nouvelle Boutique QA")
        self.page.locator('textarea[name="description"]').fill("Boutique fictive pour la recette d'approbation.")
        self.page.get_by_role("button", name="Créer ma boutique", exact=True).click()
        expect(self.page).to_have_url(BASE + "/compte/verifier-email")

        self.page.goto(mail_link(email, "/compte/verifier-email"))
        seller_password = PASSWORD + "s"
        self.page.get_by_label("Nouveau mot de passe").fill(seller_password)
        self.page.get_by_role("button", name="Confirmer", exact=True).click()
        expect(self.page.get_by_role("status")).to_contain_text("Adresse verifiee")

        pending_login = self.api("/api/auth/login", method="POST", data={"email": email, "password": seller_password})
        self.assertEqual(pending_login.status, 200)
        pending_token = pending_login.json()["token"]
        self.assertEqual(self.api("/api/sellers/me/profile", pending_token).status, 403)

        self.page.evaluate("localStorage.clear()")
        admin_token = self.login("qa-admin@test.invalid", PASSWORD, staff=True)
        sellers = self.api("/api/sellers/admin/all?status=pending", admin_token)
        self.assertEqual(sellers.status, 200)
        candidate = next(item for item in sellers.json() if item["storeName"] == "Nouvelle Boutique QA")
        approved = self.api(
            f"/api/sellers/admin/{candidate['id']}/approve",
            admin_token,
            method="PUT",
            data={"status": "approved", "commissionRate": 12},
        )
        self.assertEqual(approved.status, 200)
        self.assertEqual(approved.json()["commissionRate"], 12)
        self.assertTrue(mail_received(email, "est en ligne"))

        self.page.evaluate("localStorage.clear()")
        seller_token = self.login(email, seller_password, staff=True, expected_path="/vendeur/dashboard")
        profile = self.api("/api/sellers/me/profile", seller_token)
        self.assertEqual(profile.status, 200)
        self.assertEqual(profile.json()["storeName"], "Nouvelle Boutique QA")

    def test_12_contact_smtp_and_durable_newsletter(self):
        self.page.goto(BASE + "/contact")
        expect(self.page.get_by_role("heading", name="Nous sommes à votre écoute")).to_be_visible()
        self.page.get_by_placeholder("Ex: Fatoumata Traoré").fill("Contact QA")
        self.page.get_by_placeholder("Ex: fatoumata@exemple.com").fill("qa-contact@test.invalid")
        self.page.get_by_placeholder("Ex: Suivi de livraison, partenariat...").fill("Question QA contact")
        self.page.get_by_placeholder("Détaillez votre question ou demande...").fill(
            "Message fictif de recette pour vérifier la livraison SMTP du support."
        )
        self.page.get_by_role("button", name="Envoyer mon message").click()
        expect(self.page.get_by_role("heading", name="Message bien transmis !")).to_be_visible()
        self.assertTrue(mail_received("qa-admin@test.invalid", "Question QA contact"))

        newsletter = "qa-newsletter@test.invalid"
        footer = self.page.locator("footer")
        footer.get_by_placeholder("Votre adresse email").fill(newsletter)
        footer.get_by_role("button", name="S’inscrire").click()
        expect(footer.get_by_text("Merci pour votre inscription à la newsletter !")).to_be_visible()

        unsub = self.api("/api/newsletter/unsubscribe", method="POST", data={"email": newsletter})
        self.assertEqual(unsub.status, 200)
        resub = self.api("/api/newsletter/subscribe", method="POST", data={"email": newsletter})
        self.assertEqual(resub.status, 200)


if __name__ == "__main__":
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(BrowserAcceptance)
    started = datetime.now(timezone.utc).isoformat()
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    report = {"started_at": started, "finished_at": datetime.now(timezone.utc).isoformat(),
              "candidate_sha": os.environ.get("CANDIDATE_SHA"), "tested_merge_sha": os.environ.get("GITHUB_SHA"),
              "tests": result.testsRun, "failures": len(result.failures), "errors": len(result.errors),
              "skipped": len(result.skipped), "success": result.wasSuccessful(),
              "scope": "Isolated HTTPS browser + authenticated SMTP STARTTLS capture; fictitious data only",
              "not_validated": ["Real PSP payment/refund", "Public DNS/TLS", "External mailbox deliverability", "Production server", "Off-host backup"],
              "details": [{"test": str(test), "failure": text} for test, text in result.failures + result.errors]}
    (OUT / "result.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    raise SystemExit(0 if result.wasSuccessful() else 1)
