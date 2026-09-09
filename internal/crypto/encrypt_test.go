package crypto

import (
	"testing"
)

func TestEncryptDecrypt(t *testing.T) {
	key := DeriveKey("master-secret-key-12345")
	original := "fcm-service-account-json-sample-data"

	encrypted, err := Encrypt([]byte(original), key)
	if err != nil {
		t.Fatalf("Encrypt failed: %v", err)
	}

	if encrypted == original {
		t.Fatalf("Encrypted string should not match original")
	}

	decrypted, err := Decrypt(encrypted, key)
	if err != nil {
		t.Fatalf("Decrypt failed: %v", err)
	}

	if string(decrypted) != original {
		t.Fatalf("Expected %s, got %s", original, string(decrypted))
	}
}

func TestDecryptTampered(t *testing.T) {
	key := DeriveKey("master-secret-key-12345")
	_, err := Decrypt("invalid-ciphertext", key)
	if err == nil {
		t.Fatalf("Expected error on invalid base64")
	}
}
