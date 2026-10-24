from app.models.user import UserRole
from app.schemas.owner import OwnerCreate, OwnerUpdate
from app.schemas.treasurer import TreasurerCreate, TreasurerUpdate
from app.schemas.user import UserCreate, UserUpdate
from app.utils.names import normalize_person_name, person_name_key


class TestNormalizePersonName:
    def test_title_cases_uppercase_names(self):
        assert normalize_person_name("JUAN DE LA CRUZ") == "Juan de la Cruz"

    def test_collapses_spaces_and_respects_accents(self):
        assert normalize_person_name("  maría  josé pérez  ") == "María José Pérez"

    def test_handles_apostrophes_and_hyphens(self):
        assert normalize_person_name("o'connor") == "O'Connor"
        assert normalize_person_name("jean-pierre") == "Jean-Pierre"

    def test_keeps_connectors_lowercase_after_first_token(self):
        assert normalize_person_name("MARIA DEL CARMEN DE LOS SANTOS") == "Maria del Carmen de los Santos"

    def test_single_letter_surnames(self):
        assert normalize_person_name("JOSE DE LA O") == "Jose de la O"

    def test_none_returns_none(self):
        assert normalize_person_name(None) is None


class TestPersonNameKey:
    def test_ignores_case_and_accents(self):
        assert person_name_key("Pérez") == person_name_key("PEREZ")
        assert person_name_key("María José") == person_name_key("MARIA JOSE")

    def test_different_names_do_not_match(self):
        assert person_name_key("Juan Perez") != person_name_key("Juan Paredes")


class TestSchemaNormalization:
    def test_owner_create_normalizes(self):
        owner = OwnerCreate(full_name="JUAN DE LA CRUZ")
        assert owner.full_name == "Juan de la Cruz"

    def test_owner_update_allows_none(self):
        owner = OwnerUpdate(full_name=None)
        assert owner.full_name is None

    def test_user_create_normalizes(self):
        user = UserCreate(
            email="owner@example.com",
            password="secret123",
            role=UserRole.OWNER,
            full_name="MARIA PEREZ",
        )
        assert user.full_name == "Maria Perez"

    def test_user_update_normalizes(self):
        user = UserUpdate(full_name="juan carlos gomez")
        assert user.full_name == "Juan Carlos Gomez"

    def test_treasurer_create_and_update_normalize(self):
        created = TreasurerCreate(villa="Villa 1", name="JUAN DE LA CRUZ")
        updated = TreasurerUpdate(name="maría pérez")
        assert created.name == "Juan de la Cruz"
        assert updated.name == "María Pérez"
