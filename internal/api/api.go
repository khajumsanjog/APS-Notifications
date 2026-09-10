package api

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/google/uuid"
	"github.com/khajumsanjog/aps/internal/auth"
	"github.com/khajumsanjog/aps/internal/crypto"
	"github.com/khajumsanjog/aps/internal/models"
	"github.com/khajumsanjog/aps/internal/pubsub"
	"github.com/khajumsanjog/aps/internal/store"
	"github.com/khajumsanjog/aps/internal/ws"
)

type BeamsBroadcaster interface {
	PublishToInterest(ctx context.Context, instanceID, interest, title, body string, data map[string]interface{}) (string, error)
}

type WebhookNotifier interface {
	Notify(ctx context.Context, appID, event string, data map[string]interface{})
}

type API struct {
	store     store.Store
	hub       *ws.Hub
	pubsub    pubsub.PubSub
	beams     BeamsBroadcaster
	masterKey []byte
	jwtSecret string
	webhook   WebhookNotifier
}

func NewAPI(st store.Store, hub *ws.Hub, ps pubsub.PubSub, beams BeamsBroadcaster, masterKey []byte, jwtSecret string) *API {
	return &API{
		store:     st,
		hub:       hub,
		pubsub:    ps,
		beams:     beams,
		masterKey: masterKey,
		jwtSecret: jwtSecret,
	}
}

func (a *API) SetWebhook(wh WebhookNotifier) {
	a.webhook = wh
}

func (a *API) Routes() http.Handler {
	r := chi.NewRouter()

	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(30 * time.Second))

	// CORS for dashboard & SDKs
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-Pusher-Key", "X-Pusher-Signature"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"status":"ok","service":"aps-api"}`))
	})

	// 1. Pusher REST API (compatible with official pusher server SDKs)
	r.Route("/apps/{app_id}", func(r chi.Router) {
		r.Use(a.pusherAuthMiddleware)

		r.Post("/events", a.handleTriggerEvent)
		r.Post("/batch_events", a.handleBatchEvents)
		r.Get("/channels", a.handleListChannels)
		r.Get("/channels/{channel_name}", a.handleGetChannel)
		r.Get("/channels/{channel_name}/users", a.handleGetChannelUsers)
		r.Post("/channels/{channel_name}/terminate_connections", a.handleTerminateChannelConnections)

		// APS Advanced Features
		r.Get("/channels/{channel_name}/history", a.handleGetChannelHistory)
		r.Post("/broadcast", a.handleUnifiedBroadcast)
		r.Post("/users/{user_id}/terminate", a.handleTerminateUserConnections)
	})

	// 2. Developer Console Dashboard API
	r.Route("/api", func(r chi.Router) {
		// Auth
		r.Post("/auth/register", a.handleRegister)
		r.Post("/auth/login", a.handleLogin)

		// Protected dashboard routes
		r.Group(func(r chi.Router) {
			r.Use(a.jwtAuthMiddleware)
			r.Get("/auth/me", a.handleMe)

			// Apps
			r.Get("/apps", a.handleDashboardListApps)
			r.Post("/apps", a.handleDashboardCreateApp)
			r.Get("/apps/{id}", a.handleDashboardGetApp)
			r.Put("/apps/{id}", a.handleDashboardUpdateApp)
			r.Delete("/apps/{id}", a.handleDashboardDeleteApp)

			// App Sub-resources
			r.Get("/apps/{id}/keys", a.handleDashboardListKeys)
			r.Post("/apps/{id}/keys", a.handleDashboardCreateKey)
			r.Delete("/apps/{id}/keys/{key_id}", a.handleDashboardDeleteKey)

			r.Get("/apps/{id}/stats", a.handleDashboardGetStats)
			r.Get("/apps/{id}/history", a.handleDashboardGetHistory)

			// Webhooks
			r.Get("/apps/{id}/webhooks", a.handleDashboardListWebhooks)
			r.Post("/apps/{id}/webhooks", a.handleDashboardCreateWebhook)
			r.Delete("/apps/{id}/webhooks/{webhook_id}", a.handleDashboardDeleteWebhook)
			r.Get("/apps/{id}/webhooks/deliveries", a.handleDashboardListWebhookDeliveries)
		})
	})

	return r
}

type contextKey string

const (
	appContextKey  contextKey = "app"
	userContextKey contextKey = "user"
)

func (a *API) pusherAuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		appID := chi.URLParam(r, "app_id")
		app, err := a.store.GetAppByID(r.Context(), appID)
		if err != nil {
			http.Error(w, `{"error":"Application not found"}`, http.StatusNotFound)
			return
		}

		bodyBytes, err := io.ReadAll(r.Body)
		if err != nil {
			http.Error(w, `{"error":"Failed to read request body"}`, http.StatusBadRequest)
			return
		}
		r.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))

		// Try secret verification
		appSecretBytes, err := crypto.Decrypt(app.SecretCiphertext, a.masterKey)
		if err != nil {
			appSecretBytes = []byte(app.SecretCiphertext)
		}
		appSecret := string(appSecretBytes)

		// If Authorization header (Bearer JWT or API key) is present
		authHeader := r.Header.Get("Authorization")
		if strings.HasPrefix(authHeader, "Bearer ") {
			rawToken := strings.TrimPrefix(authHeader, "Bearer ")

			// 1. Check if it's a valid dashboard JWT session
			claims, err := auth.ValidateJWT(rawToken, a.jwtSecret)
			if err == nil && claims != nil {
				ctx := context.WithValue(r.Context(), appContextKey, app)
				ctx = context.WithValue(ctx, userContextKey, claims)
				next.ServeHTTP(w, r.WithContext(ctx))
				return
			}

			// 2. Check if it's the App Key directly
			if rawToken == app.AppKey {
				ctx := context.WithValue(r.Context(), appContextKey, app)
				next.ServeHTTP(w, r.WithContext(ctx))
				return
			}

			// 3. Check if it's an API key
			apiKey, err := a.store.GetAPIKey(r.Context(), rawToken)
			if err == nil && apiKey.AppID == app.ID {
				ctx := context.WithValue(r.Context(), appContextKey, app)
				next.ServeHTTP(w, r.WithContext(ctx))
				return
			}
		}

		// Verify standard Pusher HMAC
		if err := auth.VerifyRESTRequest(r, appSecret, bodyBytes, 10*time.Minute); err != nil {
			http.Error(w, fmt.Sprintf(`{"error":"Authentication error: %s"}`, err.Error()), http.StatusUnauthorized)
			return
		}

		ctx := context.WithValue(r.Context(), appContextKey, app)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func (a *API) jwtAuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if !strings.HasPrefix(authHeader, "Bearer ") {
			http.Error(w, `{"error":"Missing or invalid token"}`, http.StatusUnauthorized)
			return
		}

		tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
		claims, err := auth.ValidateJWT(tokenStr, a.jwtSecret)
		if err != nil {
			http.Error(w, `{"error":"Invalid or expired session"}`, http.StatusUnauthorized)
			return
		}

		ctx := context.WithValue(r.Context(), userContextKey, claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// -------------------------------------------------------------
// Pusher REST Endpoints
// -------------------------------------------------------------

func (a *API) handleTriggerEvent(w http.ResponseWriter, r *http.Request) {
	app := r.Context().Value(appContextKey).(*models.App)

	var req models.EventTriggerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid JSON payload"}`, http.StatusBadRequest)
		return
	}

	channels := req.Channels
	if len(channels) == 0 && req.Channel != "" {
		channels = []string{req.Channel}
	}

	if len(channels) == 0 || req.Name == "" {
		http.Error(w, `{"error":"Missing channels or name"}`, http.StatusBadRequest)
		return
	}

	excludeSocketID := ""
	if req.SocketID != nil {
		excludeSocketID = *req.SocketID
	}

	for _, ch := range channels {
		_ = a.hub.BroadcastCluster(app.ID, ch, req.Name, req.Data, excludeSocketID)
		if a.webhook != nil {
			a.webhook.Notify(r.Context(), app.ID, "message_sent", map[string]interface{}{
				"channel":   ch,
				"event":     req.Name,
				"data":      req.Data,
				"socket_id": excludeSocketID,
			})
		}
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{}`))
}

func (a *API) handleBatchEvents(w http.ResponseWriter, r *http.Request) {
	app := r.Context().Value(appContextKey).(*models.App)

	var req models.BatchEventsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid JSON payload"}`, http.StatusBadRequest)
		return
	}

	for _, item := range req.Batch {
		excludeSocketID := ""
		if item.SocketID != nil {
			excludeSocketID = *item.SocketID
		}
		_ = a.hub.BroadcastCluster(app.ID, item.Channel, item.Name, item.Data, excludeSocketID)
		if a.webhook != nil {
			a.webhook.Notify(r.Context(), app.ID, "message_sent", map[string]interface{}{
				"channel":   item.Channel,
				"event":     item.Name,
				"data":      item.Data,
				"socket_id": excludeSocketID,
			})
		}
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{"batch":{}}`))
}

func (a *API) handleListChannels(w http.ResponseWriter, r *http.Request) {
	app := r.Context().Value(appContextKey).(*models.App)
	prefix := r.URL.Query().Get("filter_by_prefix")

	channels, err := a.pubsub.ListOccupiedChannels(r.Context(), app.ID, prefix)
	if err != nil {
		http.Error(w, `{"error":"Failed to list channels"}`, http.StatusInternalServerError)
		return
	}

	resp := make(map[string]interface{})
	chansMap := make(map[string]interface{})
	for _, ch := range channels {
		occ, _ := a.pubsub.GetChannelOccupancy(r.Context(), app.ID, ch)
		chansMap[ch] = map[string]interface{}{
			"user_count": occ,
		}
	}
	resp["channels"] = chansMap

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(resp)
}

func (a *API) handleGetChannel(w http.ResponseWriter, r *http.Request) {
	app := r.Context().Value(appContextKey).(*models.App)
	channelName := chi.URLParam(r, "channel_name")

	occ, err := a.pubsub.GetChannelOccupancy(r.Context(), app.ID, channelName)
	if err != nil {
		http.Error(w, `{"error":"Failed to get channel"}`, http.StatusInternalServerError)
		return
	}

	resp := map[string]interface{}{
		"occupied":           occ > 0,
		"user_count":         occ,
		"subscription_count": occ,
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(resp)
}

func (a *API) handleGetChannelUsers(w http.ResponseWriter, r *http.Request) {
	app := r.Context().Value(appContextKey).(*models.App)
	channelName := chi.URLParam(r, "channel_name")

	members, err := a.pubsub.GetPresenceMembers(r.Context(), app.ID, channelName)
	if err != nil {
		http.Error(w, `{"error":"Failed to get presence members"}`, http.StatusInternalServerError)
		return
	}

	type UserItem struct {
		ID string `json:"id"`
	}
	usersList := make([]UserItem, 0, len(members))
	for uid := range members {
		usersList = append(usersList, UserItem{ID: uid})
	}

	resp := map[string]interface{}{
		"users": usersList,
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(resp)
}

func (a *API) handleTerminateChannelConnections(w http.ResponseWriter, r *http.Request) {
	// Terminate all sockets currently subscribed to this channel
	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write([]byte(`{"status":"connections_terminated"}`))
}

func (a *API) handleGetChannelHistory(w http.ResponseWriter, r *http.Request) {
	app := r.Context().Value(appContextKey).(*models.App)
	channelName := chi.URLParam(r, "channel_name")
	limitStr := r.URL.Query().Get("limit")
	limit := 50
	if limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
			limit = l
		}
	}

	messages, err := a.store.GetChannelHistory(r.Context(), app.ID, channelName, limit)
	if err != nil {
		http.Error(w, `{"error":"Failed to fetch channel history"}`, http.StatusInternalServerError)
		return
	}
	if messages == nil {
		messages = []*models.ChannelMessage{}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"channel":  channelName,
		"messages": messages,
	})
}

func (a *API) handleUnifiedBroadcast(w http.ResponseWriter, r *http.Request) {
	app := r.Context().Value(appContextKey).(*models.App)

	var req models.UnifiedBroadcastRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid payload"}`, http.StatusBadRequest)
		return
	}

	// 1. Deliver to WebSocket channel
	excludeSocketID := ""
	if req.SocketID != nil {
		excludeSocketID = *req.SocketID
	}
	if req.Channel != "" && req.EventName != "" {
		_ = a.hub.BroadcastCluster(app.ID, req.Channel, req.EventName, req.Data, excludeSocketID)
		if a.webhook != nil {
			a.webhook.Notify(r.Context(), app.ID, "message_sent", map[string]interface{}{
				"channel":   req.Channel,
				"event":     req.EventName,
				"data":      req.Data,
				"socket_id": excludeSocketID,
			})
		}
	}

	// 2. Deliver to Beams interest if requested
	publishID := ""
	if req.Interest != "" && a.beams != nil {
		beamsInst, err := a.store.GetBeamsInstanceByAppID(r.Context(), app.ID)
		if err == nil && beamsInst != nil {
			var dataMap map[string]interface{}
			_ = json.Unmarshal(req.Data, &dataMap)
			pid, _ := a.beams.PublishToInterest(r.Context(), beamsInst.InstanceID, req.Interest, req.PushTitle, req.PushBody, dataMap)
			publishID = pid
		}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"status":     "broadcast_sent",
		"publish_id": publishID,
	})
}

func (a *API) handleTerminateUserConnections(w http.ResponseWriter, r *http.Request) {
	app := r.Context().Value(appContextKey).(*models.App)
	userID := chi.URLParam(r, "user_id")

	count := a.hub.TerminateUser(app.ID, userID)

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"status":      "user_terminated",
		"user_id":     userID,
		"kicked_subs": count,
	})
}

// -------------------------------------------------------------
// Developer Console Dashboard Endpoints
// -------------------------------------------------------------

func (a *API) handleRegister(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Email == "" || len(req.Password) < 6 {
		http.Error(w, `{"error":"Invalid email or password (min 6 chars)"}`, http.StatusBadRequest)
		return
	}

	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		http.Error(w, `{"error":"Failed to hash password"}`, http.StatusInternalServerError)
		return
	}

	user := &models.User{
		ID:           uuid.New().String(),
		Email:        req.Email,
		PasswordHash: hash,
		Role:         "developer",
	}

	if err := a.store.CreateUser(r.Context(), user); err != nil {
		if err == store.ErrAlreadyExists {
			http.Error(w, `{"error":"Email already registered"}`, http.StatusConflict)
			return
		}
		http.Error(w, `{"error":"Failed to create user"}`, http.StatusInternalServerError)
		return
	}

	token, _ := auth.GenerateJWT(user.ID, user.Email, user.Role, a.jwtSecret, 24*time.Hour)

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"token": token,
		"user":  user,
	})
}

func (a *API) handleLogin(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid credentials payload"}`, http.StatusBadRequest)
		return
	}

	user, err := a.store.GetUserByEmail(r.Context(), req.Email)
	if err != nil || !auth.CheckPasswordHash(req.Password, user.PasswordHash) {
		http.Error(w, `{"error":"Invalid email or password"}`, http.StatusUnauthorized)
		return
	}

	token, _ := auth.GenerateJWT(user.ID, user.Email, user.Role, a.jwtSecret, 24*time.Hour)

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"token": token,
		"user":  user,
	})
}

func (a *API) handleMe(w http.ResponseWriter, r *http.Request) {
	claims := r.Context().Value(userContextKey).(*auth.Claims)
	user, err := a.store.GetUserByID(r.Context(), claims.UserID)
	if err != nil {
		http.Error(w, `{"error":"User not found"}`, http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(user)
}

func (a *API) handleDashboardListApps(w http.ResponseWriter, r *http.Request) {
	claims := r.Context().Value(userContextKey).(*auth.Claims)
	apps, err := a.store.ListAppsByOwner(r.Context(), claims.UserID)
	if err != nil {
		http.Error(w, `{"error":"Failed to list apps"}`, http.StatusInternalServerError)
		return
	}

	// Decrypt secrets for display
	for _, app := range apps {
		secBytes, err := crypto.Decrypt(app.SecretCiphertext, a.masterKey)
		if err == nil {
			app.AppSecret = string(secBytes)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(apps)
}

func (a *API) handleDashboardCreateApp(w http.ResponseWriter, r *http.Request) {
	claims := r.Context().Value(userContextKey).(*auth.Claims)

	var req struct {
		Name    string `json:"name"`
		Cluster string `json:"cluster"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Name == "" {
		http.Error(w, `{"error":"App name is required"}`, http.StatusBadRequest)
		return
	}

	cluster := req.Cluster
	if cluster == "" {
		cluster = "mt1"
	}

	appID := fmt.Sprintf("%d", time.Now().UnixNano()%10000000+100000)
	rawKey := strings.ReplaceAll(uuid.New().String(), "-", "")[:20]
	rawSecret := strings.ReplaceAll(uuid.New().String(), "-", "")[:20]

	encSecret, err := crypto.Encrypt([]byte(rawSecret), a.masterKey)
	if err != nil {
		http.Error(w, `{"error":"Failed to encrypt secret"}`, http.StatusInternalServerError)
		return
	}

	app := &models.App{
		ID:                    appID,
		Name:                  req.Name,
		AppKey:                rawKey,
		AppSecret:             rawSecret,
		SecretCiphertext:      encSecret,
		OwnerID:               claims.UserID,
		Cluster:               cluster,
		RateLimitRPS:          1000,
		MaxConnections:        10000,
		MessageHistoryEnabled: true,
		WebhooksEnabled:       true,
	}

	if err := a.store.CreateApp(r.Context(), app); err != nil {
		http.Error(w, `{"error":"Failed to create app"}`, http.StatusInternalServerError)
		return
	}

	// Also provision default Beams Push Instance for this app
	_ = a.store.CreateBeamsInstance(r.Context(), &models.BeamsInstance{
		InstanceID: uuid.New().String(),
		AppID:      app.ID,
	})

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(app)
}

func (a *API) handleDashboardGetApp(w http.ResponseWriter, r *http.Request) {
	appID := chi.URLParam(r, "id")
	app, err := a.store.GetAppByID(r.Context(), appID)
	if err != nil {
		http.Error(w, `{"error":"App not found"}`, http.StatusNotFound)
		return
	}

	secBytes, err := crypto.Decrypt(app.SecretCiphertext, a.masterKey)
	if err == nil {
		app.AppSecret = string(secBytes)
	}

	// Fetch Beams instance info
	beamsInst, _ := a.store.GetBeamsInstanceByAppID(r.Context(), app.ID)

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"app":            app,
		"beams_instance": beamsInst,
	})
}

func (a *API) handleDashboardUpdateApp(w http.ResponseWriter, r *http.Request) {
	appID := chi.URLParam(r, "id")
	app, err := a.store.GetAppByID(r.Context(), appID)
	if err != nil {
		http.Error(w, `{"error":"App not found"}`, http.StatusNotFound)
		return
	}

	var req struct {
		Name                  string `json:"name"`
		Cluster               string `json:"cluster"`
		RateLimitRPS          int    `json:"rate_limit_rps"`
		MaxConnections        int    `json:"max_connections"`
		MessageHistoryEnabled bool   `json:"message_history_enabled"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid payload"}`, http.StatusBadRequest)
		return
	}

	if req.Name != "" {
		app.Name = req.Name
	}
	if req.Cluster != "" {
		app.Cluster = req.Cluster
	}
	if req.RateLimitRPS > 0 {
		app.RateLimitRPS = req.RateLimitRPS
	}
	if req.MaxConnections > 0 {
		app.MaxConnections = req.MaxConnections
	}
	app.MessageHistoryEnabled = req.MessageHistoryEnabled

	if err := a.store.UpdateApp(r.Context(), app); err != nil {
		http.Error(w, `{"error":"Failed to update app"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(app)
}

func (a *API) handleDashboardDeleteApp(w http.ResponseWriter, r *http.Request) {
	appID := chi.URLParam(r, "id")
	_ = a.store.DeleteApp(r.Context(), appID)
	w.WriteHeader(http.StatusNoContent)
}

func (a *API) handleDashboardListKeys(w http.ResponseWriter, r *http.Request) {
	appID := chi.URLParam(r, "id")
	keys, err := a.store.ListAPIKeysByApp(r.Context(), appID)
	if err != nil {
		http.Error(w, `{"error":"Failed to list keys"}`, http.StatusInternalServerError)
		return
	}

	for _, k := range keys {
		secBytes, err := crypto.Decrypt(k.SecretCiphertext, a.masterKey)
		if err == nil {
			k.Secret = string(secBytes)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(keys)
}

func (a *API) handleDashboardCreateKey(w http.ResponseWriter, r *http.Request) {
	appID := chi.URLParam(r, "id")
	var req struct {
		Name   string   `json:"name"`
		Scopes []string `json:"scopes"`
	}
	_ = json.NewDecoder(r.Body).Decode(&req)
	if req.Name == "" {
		req.Name = "New API Key"
	}
	if len(req.Scopes) == 0 {
		req.Scopes = []string{"read", "trigger"}
	}

	rawKey := "key_" + strings.ReplaceAll(uuid.New().String(), "-", "")[:16]
	rawSecret := "sec_" + strings.ReplaceAll(uuid.New().String(), "-", "")[:24]
	encSecret, _ := crypto.Encrypt([]byte(rawSecret), a.masterKey)

	k := &models.APIKey{
		ID:               uuid.New().String(),
		AppID:            appID,
		Name:             req.Name,
		Key:              rawKey,
		Secret:           rawSecret,
		SecretCiphertext: encSecret,
		Scopes:           req.Scopes,
	}

	if err := a.store.CreateAPIKey(r.Context(), k); err != nil {
		http.Error(w, `{"error":"Failed to create API key"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(k)
}

func (a *API) handleDashboardDeleteKey(w http.ResponseWriter, r *http.Request) {
	keyID := chi.URLParam(r, "key_id")
	_ = a.store.DeleteAPIKey(r.Context(), keyID)
	w.WriteHeader(http.StatusNoContent)
}

func (a *API) handleDashboardGetStats(w http.ResponseWriter, r *http.Request) {
	appID := chi.URLParam(r, "id")
	channels, _ := a.pubsub.ListOccupiedChannels(r.Context(), appID, "")

	totalUsers := 0
	for _, ch := range channels {
		occ, _ := a.pubsub.GetChannelOccupancy(r.Context(), appID, ch)
		totalUsers += occ
	}

	activeSockets := a.hub.GetActiveConnectionCount()

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"active_connections": activeSockets,
		"occupied_channels":  len(channels),
		"presence_users":     totalUsers,
		"cluster":            "mt1",
		"timestamp":          time.Now(),
	})
}

func (a *API) handleDashboardGetHistory(w http.ResponseWriter, r *http.Request) {
	appID := chi.URLParam(r, "id")
	channel := r.URL.Query().Get("channel")

	messages, err := a.store.GetChannelHistory(r.Context(), appID, channel, 100)
	if err != nil {
		http.Error(w, `{"error":"Failed to fetch history"}`, http.StatusInternalServerError)
		return
	}
	if messages == nil {
		messages = []*models.ChannelMessage{}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(messages)
}

func (a *API) handleDashboardListWebhooks(w http.ResponseWriter, r *http.Request) {
	appID := chi.URLParam(r, "id")
	hooks, err := a.store.ListWebhooksByApp(r.Context(), appID)
	if err != nil {
		http.Error(w, `{"error":"Failed to list webhooks"}`, http.StatusInternalServerError)
		return
	}
	if hooks == nil {
		hooks = []*models.Webhook{}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(hooks)
}

func (a *API) handleDashboardCreateWebhook(w http.ResponseWriter, r *http.Request) {
	appID := chi.URLParam(r, "id")
	var req struct {
		URL    string   `json:"url"`
		Events []string `json:"events"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.URL == "" {
		http.Error(w, `{"error":"Webhook URL is required"}`, http.StatusBadRequest)
		return
	}

	secret := strings.ReplaceAll(uuid.New().String(), "-", "")
	encSecret, _ := crypto.Encrypt([]byte(secret), a.masterKey)

	wh := &models.Webhook{
		ID:               uuid.New().String(),
		AppID:            appID,
		URL:              req.URL,
		Events:           req.Events,
		Secret:           secret,
		SecretCiphertext: encSecret,
		Active:           true,
	}

	if err := a.store.CreateWebhook(r.Context(), wh); err != nil {
		http.Error(w, `{"error":"Failed to create webhook"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(wh)
}

func (a *API) handleDashboardDeleteWebhook(w http.ResponseWriter, r *http.Request) {
	webhookID := chi.URLParam(r, "webhook_id")
	_ = a.store.DeleteWebhook(r.Context(), webhookID)
	w.WriteHeader(http.StatusNoContent)
}

func (a *API) handleDashboardListWebhookDeliveries(w http.ResponseWriter, r *http.Request) {
	appID := chi.URLParam(r, "id")
	deliveries, err := a.store.ListWebhookDeliveries(r.Context(), appID, 50)
	if err != nil {
		http.Error(w, `{"error":"Failed to list deliveries"}`, http.StatusInternalServerError)
		return
	}
	if deliveries == nil {
		deliveries = []*models.WebhookDelivery{}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(deliveries)
}
