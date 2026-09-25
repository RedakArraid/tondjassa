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
if len(PASSWORD) < 16:
    raise RuntimeError("E2E_PASSWORD must be generated for this isolated run")
TOKEN_KEY = "mandemarket_customer_token"
EXTERNAL = re.compile(r"^https?://(?!localhost:3443(?:/|$))")


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

    def login(self, email, password, staff=False):
        self.page.goto(BASE + ("/admin/login" if staff else "/compte/login"))
        self.page.locator('form input[type="email"]').first.fill(email)
        self.page.locator('form input[type="password"]').first.fill(password)
        self.page.get_by_role("button", name="Se connecter", exact=True).click()
        target = "/vendeur/dashboard" if email == "qa-seller@test.invalid" else "/admin/dashboard" if staff else "/compte/dashboard"
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
