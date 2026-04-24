from pathlib import Path
import unittest


PROJECT_ROOT = Path(__file__).resolve().parents[2]
FRONTEND_APP = PROJECT_ROOT / "munch-catering-frontend-expo" / "app" / "index.tsx"
FRONTEND_TYPES = PROJECT_ROOT / "munch-catering-frontend-expo" / "lib" / "munch-data.ts"


class FrontendSourceContractTests(unittest.TestCase):
    def test_login_screen_has_no_hardcoded_credentials(self):
        source = FRONTEND_APP.read_text(encoding="utf-8")
        self.assertIn("setLoginDraft({ email: '', password: '' })", source)
        auth_slice = source[source.index("props.screen === 'login'") : source.index("props.screen === 'signup'")]
        self.assertNotIn("guest@munch.app", auth_slice)
        self.assertNotIn("chef@harvesttable.co.ke", auth_slice)
        self.assertNotIn("value=\"", auth_slice)

    def test_deprecated_shadow_props_are_removed(self):
        source = FRONTEND_APP.read_text(encoding="utf-8")
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


if __name__ == "__main__":
    unittest.main()
