package webhook

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/khajumsanjog/aps/internal/auth"
	"github.com/khajumsanjog/aps/internal/crypto"
	"github.com/khajumsanjog/aps/internal/models"
	"github.com/khajumsanjog/aps/internal/store"
)

func TestWebhookDispatch(t *testing.T) {
	ctx := context.Background()
	st := store.NewMemoryStore()
	masterKey := crypto.DeriveKey("test-master-key")

	appKey := "wh-app-key"
	appSecret := "wh-app-secret"
	encSecret, _ := crypto.Encrypt([]byte(appSecret), masterKey)

	app := &models.App{
		ID:               "app-wh-1",
		Name:             "Webhook Test App",
		AppKey:           appKey,
		SecretCiphertext: encSecret,
		OwnerID:          "usr-1",
	}
	_ = st.CreateApp(ctx, app)

	var receivedKey string
	var receivedSig string
	var receivedBody []byte
	var wg sync.WaitGroup
	wg.Add(1)

	webhookServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		receivedKey = r.Header.Get("X-Pusher-Key")
		receivedSig = r.Header.Get("X-Pusher-Signature")
		receivedBody, _ = io.ReadAll(r.Body)
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"received":true}`))
		wg.Done()
	}))
	defer webhookServer.Close()

	wh := &models.Webhook{
		ID:               "wh-1",
		AppID:            "app-wh-1",
		URL:              webhookServer.URL,
		Events:           []string{"channel_occupied"},
		Secret:           appSecret,
		SecretCiphertext: encSecret,
		Active:           true,
	}
	_ = st.CreateWebhook(ctx, wh)

	dispatcher := NewDispatcher(st, masterKey)
	dispatcher.Notify(ctx, "app-wh-1", "channel_occupied", map[string]interface{}{
		"channel": "orders",
	})

	done := make(chan struct{})
	go func() {
		wg.Wait()
		close(done)
	}()

	select {
	case <-done:
		if receivedKey != appKey {
			t.Fatalf("Expected key %s, got %s", appKey, receivedKey)
		}
		if !auth.VerifyWebhook(appSecret, receivedBody, receivedSig) {
			t.Fatalf("Webhook signature verification failed")
		}
	case <-time.After(2 * time.Second):
		t.Fatalf("Timed out waiting for webhook")
	}
}
