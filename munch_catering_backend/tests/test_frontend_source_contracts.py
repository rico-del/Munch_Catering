from pathlib import Path
import unittest


PROJECT_ROOT = Path(__file__).resolve().parents[2]
FRONTEND_APP = PROJECT_ROOT / "munch-catering-frontend-expo" / "app" / "index.tsx"
FRONTEND_AUTH_FLOW = PROJECT_ROOT / "munch-catering-frontend-expo" / "features" / "auth" / "auth-flow.tsx"
FRONTEND_BUTTONS = PROJECT_ROOT / "munch-catering-frontend-expo" / "components" / "munch" / "buttons.tsx"
FRONTEND_TYPES = PROJECT_ROOT / "munch-catering-frontend-expo" / "lib" / "munch-data.ts"


class FrontendSourceContractTests(unittest.TestCase):
    def test_login_screen_has_no_hardcoded_credentials(self):
        app_source = FRONTEND_APP.read_text(encoding="utf-8")
        source = FRONTEND_AUTH_FLOW.read_text(encoding="utf-8")
        self.assertIn("setLoginDraft({ email: '', password: '' })", app_source)
        auth_slice = source[source.index("props.screen === 'login'") : source.index("props.screen === 'signup'")]
        self.assertNotIn("guest@munch.app", auth_slice)
        self.assertNotIn("chef@harvesttable.co.ke", auth_slice)
        self.assertNotIn("value=\"", auth_slice)

    def test_deprecated_shadow_props_are_removed(self):
        source = FRONTEND_APP.read_text(encoding="utf-8") + FRONTEND_BUTTONS.read_text(encoding="utf-8")
        for token in ("shadowColor", "shadowOffset", "shadowOpacity", "shadowRadius"):
            self.assertNotIn(token, source)
        self.assertIn("boxShadow", source)

    def test_frontend_uses_backend_lifecycle_contracts(self):
        app_source = FRONTEND_APP.read_text(encoding="utf-8")
        types_source = FRONTEND_TYPES.read_text(encoding="utf-8")
        self.assertIn("lifecycleStage", types_source)
        self.assertIn("isPayable", types_source)
        self.assertIn("paymentProvider", types_source)
        self.assertIn("quote_approved_awaiting_payment", app_source)
        self.assertIn("request_pending", app_source)
        self.assertIn("request_rejected", app_source)
        self.assertIn("completed", app_source)

    def test_guest_browsing_is_public_but_service_actions_require_login(self):
        source = FRONTEND_APP.read_text(encoding="utf-8")
        self.assertIn("setRoute({ name: 'customer' })", source)
        self.assertIn("const catererPayload = await api.getCaterers();", source)
        self.assertIn("const loadPublicData", source)
        self.assertIn("serviceAuthMessage", source)
        self.assertIn("requireCustomerSession", source)
        self.assertIn("handleCustomerTabChange", source)
        self.assertIn("Sign in to send a quote request", source)
        self.assertIn("Sign in to create a booking", source)


if __name__ == "__main__":
    unittest.main()
