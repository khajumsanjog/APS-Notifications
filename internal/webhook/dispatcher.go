package webhook

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"slices"
	"time"

	"github.com/google/uuid"
	"github.com/khajumsanjog/aps/internal/auth"
	"github.com/khajumsanjog/aps/internal/crypto"
	"github.com/khajumsanjog/aps/internal/models"
	"github.com/khajumsanjog/aps/internal/store"
)

type Dispatcher struct {
	store      store.Store
	masterKey  []byte
	httpClient *http.Client
}

func NewDispatcher(st store.Store, masterKey []byte) *Dispatcher {
	return &Dispatcher{
		store:     st,
		masterKey: masterKey,
		httpClient: &http.Client{
			Timeout: 5 * time.Second,
		},
	}
}

type WebhookPayload struct {
	TimeMs int64                    `json:"time_ms"`
	Events []map[string]interface{} `json:"events"`
}

func (d *Dispatcher) Notify(ctx context.Context, appID, event string, data map[string]interface{}) {
	// Asynchronous dispatch so WebSocket handlers are not blocked
	go func() {
		dispatchCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()

		hooks, err := d.store.ListWebhooksByApp(dispatchCtx, appID)
		if err != nil || len(hooks) == 0 {
			return
		}

		app, err := d.store.GetAppByID(dispatchCtx, appID)
		if err != nil {
			return
		}

		appSecretBytes, err := crypto.Decrypt(app.SecretCiphertext, d.masterKey)
		if err != nil {
			appSecretBytes = []byte(app.SecretCiphertext)
		}
		appSecret := string(appSecretBytes)

		eventItem := map[string]interface{}{
			"name": event,
		}
		for k, v := range data {
			eventItem[k] = v
		}

		payload := WebhookPayload{
			TimeMs: time.Now().UnixMilli(),
			Events: []map[string]interface{}{eventItem},
		}

		payloadBytes, _ := json.Marshal(payload)
		signature := auth.SignWebhook(appSecret, payloadBytes)

		for _, wh := range hooks {
			if !wh.Active {
				continue
			}
			// Check if webhook is subscribed to this event
			if len(wh.Events) > 0 && !slices.Contains(wh.Events, event) {
				continue
			}

			d.deliver(dispatchCtx, wh, app.AppKey, signature, payloadBytes, event)
		}
	}()
}

func (d *Dispatcher) deliver(ctx context.Context, wh *models.Webhook, appKey, signature string, payload []byte, eventName string) {
	deliveryID := uuid.New().String()
	req, err := http.NewRequestWithContext(ctx, "POST", wh.URL, bytes.NewReader(payload))
	if err != nil {
		_ = d.store.SaveWebhookDelivery(ctx, &models.WebhookDelivery{
			ID:         deliveryID,
			WebhookID:  wh.ID,
			AppID:      wh.AppID,
			Event:      eventName,
			Payload:    payload,
			Status:     "failed",
			Error:      err.Error(),
			StatusCode: 0,
		})
		return
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Pusher-Key", appKey)
	req.Header.Set("X-Pusher-Signature", signature)

	resp, err := d.httpClient.Do(req)
	if err != nil {
		_ = d.store.SaveWebhookDelivery(ctx, &models.WebhookDelivery{
			ID:         deliveryID,
			WebhookID:  wh.ID,
			AppID:      wh.AppID,
			Event:      eventName,
			Payload:    payload,
			Status:     "failed",
			Error:      err.Error(),
			StatusCode: 0,
		})
		return
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))

	status := "success"
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		status = "failed"
	}

	_ = d.store.SaveWebhookDelivery(ctx, &models.WebhookDelivery{
		ID:           deliveryID,
		WebhookID:    wh.ID,
		AppID:        wh.AppID,
		Event:        eventName,
		Payload:      payload,
		StatusCode:   resp.StatusCode,
		ResponseBody: string(respBody),
		Status:       status,
	})
}
