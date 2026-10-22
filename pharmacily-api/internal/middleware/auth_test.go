package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

const testSecret = "test-jwt-secret"

func mintToken(t *testing.T, pharmacyID, pharmacyRole string) string {
	t.Helper()
	claims := jwt.MapClaims{
		"sub":  uuid.NewString(),
		"role": "authenticated",
		"exp":  time.Now().Add(time.Hour).Unix(),
		"app_metadata": map[string]interface{}{
			"role": "pharmacy_staff",
		},
	}
	if pharmacyRole != "" {
		claims["app_metadata"].(map[string]interface{})["pharmacy_role"] = pharmacyRole
	}
	if pharmacyID != "" {
		claims["app_metadata"].(map[string]interface{})["pharmacy_id"] = pharmacyID
	}
	tok := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := tok.SignedString([]byte(testSecret))
	if err != nil {
		t.Fatalf("sign token: %v", err)
	}
	return signed
}

func TestRequireAuth(t *testing.T) {
	handler := RequireAuth(testSecret)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		info := FromContext(r.Context())
		if info == nil {
			t.Error("AuthInfo missing from context")
			return
		}
		if info.UserID == uuid.Nil {
			t.Error("UserID is nil")
		}
		if !info.HasPharmacy() {
			t.Error("expected pharmacy bound")
		}
		if !info.IsPharmacist() {
			t.Error("expected pharmacist role")
		}
		w.WriteHeader(http.StatusOK)
	}))

	token := mintToken(t, uuid.NewString(), "pharmacist")
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
}

func TestRequireAuthMissingToken(t *testing.T) {
	handler := RequireAuth(testSecret)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("handler should not run without a token")
	}))
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rec.Code)
	}
}

func TestRequireAuthWrongSecret(t *testing.T) {
	claims := jwt.MapClaims{
		"sub": uuid.NewString(),
		"exp": time.Now().Add(time.Hour).Unix(),
	}
	tok := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := tok.SignedString([]byte("other-secret"))
	if err != nil {
		t.Fatalf("sign: %v", err)
	}

	handler := RequireAuth(testSecret)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("handler should not run with an invalid token")
	}))
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer "+signed)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rec.Code)
	}
}

func TestRequireAuthUnboundPharmacy(t *testing.T) {
	handler := RequireAuth(testSecret)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		info := FromContext(r.Context())
		if info.HasPharmacy() {
			t.Error("expected no pharmacy bound")
		}
		w.WriteHeader(http.StatusOK)
	}))
	token := mintToken(t, "", "")
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 (auth ok, handler decides on pharmacy), got %d", rec.Code)
	}
}
