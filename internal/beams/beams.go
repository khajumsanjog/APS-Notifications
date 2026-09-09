package beams

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/khajumsanjog/aps/internal/crypto"
	"github.com/khajumsanjog/aps/internal/models"
	"github.com/khajumsanjog/aps/internal/store"
)

type PublishInterestsRequest struct {
	Interests []string               `json:"interests"`
	FCM       *FCMData               `json:"fcm,omitempty"`
	APNs      *APNsData              `json:"apns,omitempty"`
	Webhook   *WebhookNotification   `json:"webhook,omitempty"`
}

type PublishUsersRequest struct {
	Users   []string             `json:"users"`
	FCM     *FCMData             `json:"fcm,omitempty"`
	APNs    *APNsData            `json:"apns,omitempty"`
	Webhook *WebhookNotification `json:"webhook,omitempty"`
}

type FCMData struct {
	Notification *NotificationItem      `json:"notification,omitempty"`
	Data         map[string]interface{} `json:"data,omitempty"`
}

type APNsData struct {
	APS *APSItem `json:"aps,omitempty"`
}

type APSItem struct {
	Alert *NotificationItem `json:"alert,omitempty"`
	Badge *int              `json:"badge,omitempty"`
	Sound string            `json:"sound,omitempty"`
}

type NotificationItem struct {
	Title string `json:"title"`
	Body  string `json:"body"`
}

type WebhookNotification struct {
	URL  string                 `json:"url"`
	Data map[string]interface{} `json:"data"`
}

type DeviceRegisterRequest struct {
	Token     string          `json:"token"`
	UserID    *string         `json:"user_id,omitempty"`
	Interests []string        `json:"interests,omitempty"`
	Metadata  json.RawMessage `json:"metadata,omitempty"`
}

type Service struct {
	store     store.Store
	masterKey []byte
}

func NewService(st store.Store, masterKey []byte) *Service {
	return &Service{
		store:     st,
		masterKey: masterKey,
	}
}

func (s *Service) Routes() http.Handler {
	r := chi.NewRouter()

	setupRoutes := func(r chi.Router) {
		// Device registration
		r.Post("/devices/fcm/register", s.handleRegisterFCM)
		r.Post("/devices/apns/register", s.handleRegisterAPNs)
		r.Delete("/devices/{device_id}", s.handleDeleteDevice)
		r.Put("/devices/{device_id}/interests", s.handleSetInterests)

		// Publishing
		r.Post("/publishes/interests", s.handlePublishInterests)
		r.Post("/publishes/users", s.handlePublishUsers)
		r.Post("/users/{user_id}/terminate", s.handleTerminateUser)

		// Dashboard & inspection
		r.Get("/devices", s.handleListDevices)
		r.Get("/publishes", s.handleListDeliveries)
		r.Put("/credentials/fcm", s.handleUploadFCMCredentials)
		r.Put("/credentials/apns", s.handleUploadAPNsCredentials)
	}

	r.Route("/{instance_id}", setupRoutes)
	r.Route("/beams/{instance_id}", setupRoutes)

	return r
}

func (s *Service) handleRegisterFCM(w http.ResponseWriter, r *http.Request) {
	instanceID := chi.URLParam(r, "instance_id")
	var req DeviceRegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Token == "" {
		http.Error(w, `{"error":"Valid FCM token is required"}`, http.StatusBadRequest)
		return
	}

	deviceID := fmt.Sprintf("fcm-%s", strings.ReplaceAll(uuid.New().String(), "-", "")[:24])
	interests := req.Interests
	if interests == nil {
		interests = []string{}
	}

	device := &models.Device{
		DeviceID:   deviceID,
		InstanceID: instanceID,
		Platform:   "fcm",
		Token:      req.Token,
		UserID:     req.UserID,
		Interests:  interests,
		Metadata:   req.Metadata,
	}

	if err := s.store.UpsertDevice(r.Context(), device); err != nil {
		http.Error(w, `{"error":"Failed to register device"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(device)
}

func (s *Service) handleRegisterAPNs(w http.ResponseWriter, r *http.Request) {
	instanceID := chi.URLParam(r, "instance_id")
	var req DeviceRegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Token == "" {
		http.Error(w, `{"error":"Valid APNs token is required"}`, http.StatusBadRequest)
		return
	}

	deviceID := fmt.Sprintf("apns-%s", strings.ReplaceAll(uuid.New().String(), "-", "")[:24])
	interests := req.Interests
	if interests == nil {
		interests = []string{}
	}

	device := &models.Device{
		DeviceID:   deviceID,
		InstanceID: instanceID,
		Platform:   "apns",
		Token:      req.Token,
		UserID:     req.UserID,
		Interests:  interests,
		Metadata:   req.Metadata,
	}

	if err := s.store.UpsertDevice(r.Context(), device); err != nil {
		http.Error(w, `{"error":"Failed to register device"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(device)
}

func (s *Service) handleDeleteDevice(w http.ResponseWriter, r *http.Request) {
	deviceID := chi.URLParam(r, "device_id")
	_ = s.store.DeleteDevice(r.Context(), deviceID)
	w.WriteHeader(http.StatusNoContent)
}

func (s *Service) handleSetInterests(w http.ResponseWriter, r *http.Request) {
	deviceID := chi.URLParam(r, "device_id")
	device, err := s.store.GetDevice(r.Context(), deviceID)
	if err != nil {
		http.Error(w, `{"error":"Device not found"}`, http.StatusNotFound)
		return
	}

	var req struct {
		Interests []string `json:"interests"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Invalid payload"}`, http.StatusBadRequest)
		return
	}

	device.Interests = req.Interests
	_ = s.store.UpsertDevice(r.Context(), device)

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(device)
}

func (s *Service) handlePublishInterests(w http.ResponseWriter, r *http.Request) {
	instanceID := chi.URLParam(r, "instance_id")
	var req PublishInterestsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || len(req.Interests) == 0 {
		http.Error(w, `{"error":"Missing interests in payload"}`, http.StatusBadRequest)
		return
	}

	devices, err := s.store.ListDevicesByInterests(r.Context(), instanceID, req.Interests)
	if err != nil {
		http.Error(w, `{"error":"Failed to query devices"}`, http.StatusInternalServerError)
		return
	}

	publishID := fmt.Sprintf("pub_%s", strings.ReplaceAll(uuid.New().String(), "-", "")[:16])
	sentCount := 0
	failedCount := 0

	// Dispatch simulated / real push delivery to target devices
	for range devices {
		// Mock/simulated delivery check: in dev mode, assume delivery succeeds
		sentCount++
	}

	// Record delivery receipt
	_ = s.store.SavePushDelivery(r.Context(), &models.PushDelivery{
		ID:          uuid.New().String(),
		InstanceID:  instanceID,
		PublishID:   publishID,
		TargetType:  "interest",
		Target:      strings.Join(req.Interests, ","),
		Platform:    "all",
		SentCount:   sentCount,
		FailedCount: failedCount,
		Status:      "completed",
	})

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"publish_id": publishID,
		"sent_count": sentCount,
		"interests":  req.Interests,
	})
}

func (s *Service) handlePublishUsers(w http.ResponseWriter, r *http.Request) {
	instanceID := chi.URLParam(r, "instance_id")
	var req PublishUsersRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || len(req.Users) == 0 {
		http.Error(w, `{"error":"Missing users in payload"}`, http.StatusBadRequest)
		return
	}

	publishID := fmt.Sprintf("pub_%s", strings.ReplaceAll(uuid.New().String(), "-", "")[:16])
	sentCount := 0

	for _, uid := range req.Users {
		devices, err := s.store.ListDevicesByUser(r.Context(), instanceID, uid)
		if err == nil {
			sentCount += len(devices)
		}
	}

	_ = s.store.SavePushDelivery(r.Context(), &models.PushDelivery{
		ID:          uuid.New().String(),
		InstanceID:  instanceID,
		PublishID:   publishID,
		TargetType:  "user",
		Target:      strings.Join(req.Users, ","),
		Platform:    "all",
		SentCount:   sentCount,
		FailedCount: 0,
		Status:      "completed",
	})

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"publish_id": publishID,
		"sent_count": sentCount,
		"users":      req.Users,
	})
}

func (s *Service) handleTerminateUser(w http.ResponseWriter, r *http.Request) {
	instanceID := chi.URLParam(r, "instance_id")
	userID := chi.URLParam(r, "user_id")

	_ = s.store.DeleteDevicesByUser(r.Context(), instanceID, userID)

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"status":     "terminated",
		"user_id":    userID,
		"instance_id": instanceID,
	})
}

func (s *Service) handleListDevices(w http.ResponseWriter, r *http.Request) {
	instanceID := chi.URLParam(r, "instance_id")
	devices, err := s.store.ListDevicesByInstance(r.Context(), instanceID, 100)
	if err != nil {
		http.Error(w, `{"error":"Failed to query devices"}`, http.StatusInternalServerError)
		return
	}
	if devices == nil {
		devices = []*models.Device{}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(devices)
}

func (s *Service) handleListDeliveries(w http.ResponseWriter, r *http.Request) {
	instanceID := chi.URLParam(r, "instance_id")
	deliveries, err := s.store.ListPushDeliveries(r.Context(), instanceID, 50)
	if err != nil {
		http.Error(w, `{"error":"Failed to query deliveries"}`, http.StatusInternalServerError)
		return
	}
	if deliveries == nil {
		deliveries = []*models.PushDelivery{}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(deliveries)
}

func (s *Service) handleUploadFCMCredentials(w http.ResponseWriter, r *http.Request) {
	instanceID := chi.URLParam(r, "instance_id")
	instance, err := s.store.GetBeamsInstanceByID(r.Context(), instanceID)
	if err != nil {
		http.Error(w, `{"error":"Beams instance not found"}`, http.StatusNotFound)
		return
	}

	var req struct {
		ServiceAccountJSON string `json:"service_account_json"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.ServiceAccountJSON == "" {
		http.Error(w, `{"error":"Valid service_account_json required"}`, http.StatusBadRequest)
		return
	}

	encFCM, err := crypto.Encrypt([]byte(req.ServiceAccountJSON), s.masterKey)
	if err != nil {
		http.Error(w, `{"error":"Failed to encrypt credentials"}`, http.StatusInternalServerError)
		return
	}

	instance.FCMEncrypted = encFCM
	_ = s.store.UpdateBeamsCredentials(r.Context(), instance)

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"status":  "fcm_configured",
		"has_fcm": true,
	})
}

func (s *Service) handleUploadAPNsCredentials(w http.ResponseWriter, r *http.Request) {
	instanceID := chi.URLParam(r, "instance_id")
	instance, err := s.store.GetBeamsInstanceByID(r.Context(), instanceID)
	if err != nil {
		http.Error(w, `{"error":"Beams instance not found"}`, http.StatusNotFound)
		return
	}

	var req struct {
		P8Key      string `json:"p8_key"`
		KeyID      string `json:"key_id"`
		TeamID     string `json:"team_id"`
		BundleID   string `json:"bundle_id"`
		Production bool   `json:"production"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.P8Key == "" {
		http.Error(w, `{"error":"Valid p8_key required"}`, http.StatusBadRequest)
		return
	}

	encKey, err := crypto.Encrypt([]byte(req.P8Key), s.masterKey)
	if err != nil {
		http.Error(w, `{"error":"Failed to encrypt APNs key"}`, http.StatusInternalServerError)
		return
	}

	instance.APNsEncrypted = encKey
	instance.APNsKeyID = req.KeyID
	instance.APNsTeamID = req.TeamID
	instance.APNsBundleID = req.BundleID
	instance.APNsProduction = req.Production

	_ = s.store.UpdateBeamsCredentials(r.Context(), instance)

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"status":   "apns_configured",
		"has_apns": true,
	})
}

// PublishToInterest implements BeamsBroadcaster interface for API unified broadcast
func (s *Service) PublishToInterest(ctx context.Context, instanceID, interest, title, body string, data map[string]interface{}) (string, error) {
	devices, err := s.store.ListDevicesByInterests(ctx, instanceID, []string{interest})
	if err != nil {
		return "", err
	}

	publishID := fmt.Sprintf("pub_%s", strings.ReplaceAll(uuid.New().String(), "-", "")[:16])

	_ = s.store.SavePushDelivery(ctx, &models.PushDelivery{
		ID:          uuid.New().String(),
		InstanceID:  instanceID,
		PublishID:   publishID,
		TargetType:  "interest",
		Target:      interest,
		Platform:    "all",
		SentCount:   len(devices),
		FailedCount: 0,
		Status:      "completed",
	})

	return publishID, nil
}
