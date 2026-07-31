package api

import "testing"

func TestPrefixEmbeddingText(t *testing.T) {
	if got := prefixEmbeddingText("как дела", "query"); got != "query: как дела" {
		t.Fatalf("query prefix = %q", got)
	}
	if got := prefixEmbeddingText("важный факт", "passage"); got != "passage: важный факт" {
		t.Fatalf("passage prefix = %q", got)
	}
	if got := prefixEmbeddingText("старый клиент", ""); got != "passage: старый клиент" {
		t.Fatalf("compatibility prefix = %q", got)
	}
	if got := prefixEmbeddingText("query: уже готово", "passage"); got != "query: уже готово" {
		t.Fatalf("existing prefix = %q", got)
	}
}
