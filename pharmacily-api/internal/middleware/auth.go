// Package middleware provides chi middleware for the Pharmacily API.
package middleware

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

type contextKey string

const authInfoKey contextKey = "authInfo"

// AuthInfo is the verified identity extracted from a Supabase access token.
type AuthInfo struct {
	UserID       uuid.UUID
	PharmacyID   uuid.UUID // zero if no pharmacy bound yet
	PharmacyRole string    // 'pharmacist' | 'staff' | ''
	Role         string    // top-level JWT role, expected 'authenticated'
}

func (a *AuthInfo) HasPharmacy() bool {
	return a.PharmacyID != uuid.Nil
}

func (a *AuthInfo) IsPharmacist() bool {
	return a.PharmacyRole == "pharmacist"
}

// FromContext returns the AuthInfo set by RequireAuth, or nil.
func FromContext(ctx context.Context) *AuthInfo {
	info, _ := ctx.Value(authInfoKey).(*AuthInfo)
	return info
}

// supabaseClaims mirrors the subset of a Supabase access token we need.
// app_metadata nests (AGENTS §6): role/pharmacy_role/pharmacy_id live under
// app_metadata, never at the top level.
type supabaseClaims struct {
	jwt.RegisteredClaims
	AppMetadata struct {
		Role         string `json:"role"`
		PharmacyRole string `json:"pharmacy_role"`
		PharmacyID   string `json:"pharmacy_id"`
	} `json:"app_metadata"`
}

// RequireAuth verifies a Supabase HS256 access token and stores the claims.
// It does NOT check pharmacy binding — individual handlers decide whether a
// missing pharmacy_id is a 403 or acceptable.
func RequireAuth(jwtSecret string) func(http.Handler) http.Handler {
	key := []byte(jwtSecret)
	parser := jwt.NewParser(jwt.WithValidMethods([]string{"HS256"}))

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			header := r.Header.Get("Authorization")
			if header == "" || !strings.HasPrefix(header, "Bearer ") {
				writeJSONError(w, http.StatusUnauthorized, "missing bearer token")
				return
			}
			raw := strings.TrimPrefix(header, "Bearer ")

			claims := &supabaseClaims{}
			token, err := parser.ParseWithClaims(raw, claims, func(t *jwt.Token) (interface{}, error) {
				return key, nil
			})
			if err != nil || !token.Valid {
				writeJSONError(w, http.StatusUnauthorized, "invalid or expired token")
				return
			}

			uid, err := uuid.Parse(claims.Subject)
			if err != nil {
				writeJSONError(w, http.StatusUnauthorized, "invalid token subject")
				return
			}

			info := &AuthInfo{
				UserID:       uid,
				PharmacyRole: claims.AppMetadata.PharmacyRole,
				Role:         claims.AppMetadata.Role,
			}
			if pid, err := uuid.Parse(claims.AppMetadata.PharmacyID); err == nil {
				info.PharmacyID = pid
			}

			next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), authInfoKey, info)))
		})
	}
}

func writeJSONError(w http.ResponseWriter, status int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(map[string]string{"error": msg}); err != nil {
		log.Error().Err(err).Msg("encode error response failed")
	}
}
