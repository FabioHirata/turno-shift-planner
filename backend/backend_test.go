package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
)

func testStore(t *testing.T) *Store {
	t.Helper()
	s, err := openStore(filepath.Join(t.TempDir(), "week.json"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = s.Close() })
	return s
}
func call(t *testing.T, h http.Handler, method, path, body string) *httptest.ResponseRecorder {
	t.Helper()
	r := httptest.NewRequest(method, "http://localhost"+path, strings.NewReader(body))
	if body != "" {
		r.Header.Set("Content-Type", "application/json")
	}
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	return w
}
func decodeResponse(t *testing.T, w *httptest.ResponseRecorder) Response {
	t.Helper()
	if w.Code != 200 {
		t.Fatalf("status %d: %s", w.Code, w.Body.String())
	}
	var r Response
	if err := json.Unmarshal(w.Body.Bytes(), &r); err != nil {
		t.Fatal(err)
	}
	return r
}
func TestInitialReport(t *testing.T) {
	r := analyze(demo())
	if r.Covered != 12 || r.TotalHours != 104 || len(r.Conflicts) != 1 || r.Conflicts[0].PersonID != "clara" || *r.Conflicts[0].Day != 1 {
		t.Fatalf("unexpected report %+v", r)
	}
	s := demo()
	s.Assignments["ana"][5] = "morning"
	r = analyze(s)
	if r.Hours["ana"] != 48 || r.Coverage[5].Morning != 1 || len(r.Conflicts) != 3 {
		t.Fatalf("unavailable hours must count as planned, not coverage: %+v", r)
	}
}
func TestAssignmentsAvailabilityAndResetHTTP(t *testing.T) {
	s := testStore(t)
	h := newHandler(s, t.TempDir())
	initial := decodeResponse(t, call(t, h, "GET", basePath, ""))
	if initial.Revision != 1 || initial.Report.Covered != 12 {
		t.Fatal(initial)
	}
	changes := []string{
		`{"revision":1,"personId":"clara","day":1,"shift":"off"}`,
		`{"revision":2,"personId":"bruno","day":1,"shift":"afternoon"}`,
		`{"revision":3,"personId":"davi","day":6,"shift":"afternoon"}`,
	}
	var state Response
	for _, body := range changes {
		state = decodeResponse(t, call(t, h, "PATCH", basePath+"/assignments", body))
	}
	if state.Revision != 4 || state.Report.Covered != 14 || len(state.Report.Conflicts) != 0 {
		t.Fatalf("repair failed %+v", state)
	}
	state = decodeResponse(t, call(t, h, "PUT", basePath+"/availability", `{"revision":4,"personId":"davi","day":6,"shifts":["afternoon"]}`))
	if state.Report.Covered != 13 || len(state.Report.Conflicts) != 1 {
		t.Fatalf("availability not applied %+v", state)
	}
	state = decodeResponse(t, call(t, h, "DELETE", basePath+"/assignments/davi/6?revision=5", ""))
	if state.Assignments["davi"][6] != "off" || len(state.Report.Conflicts) != 0 {
		t.Fatal(state)
	}
	state = decodeResponse(t, call(t, h, "POST", basePath+"/reset", `{"revision":6}`))
	if state.Revision != 7 || state.Report.Covered != 12 || len(state.Availability["davi"]) != 1 {
		t.Fatal(state)
	}
}
func TestWholeWeekReplace(t *testing.T) {
	s := testStore(t)
	h := newHandler(s, t.TempDir())
	next := demo()
	next.Assignments["davi"][6] = "afternoon"
	data, _ := json.Marshal(map[string]any{"revision": 1, "assignments": next.Assignments, "availability": next.Availability})
	result := decodeResponse(t, call(t, h, "PUT", basePath, string(data)))
	if result.Revision != 2 || result.Report.Covered != 13 {
		t.Fatal(result)
	}
	next.Assignments["intruder"] = []string{}
	data, _ = json.Marshal(map[string]any{"revision": 2, "assignments": next.Assignments, "availability": next.Availability})
	if w := call(t, h, "PUT", basePath, string(data)); w.Code != 422 {
		t.Fatalf("%d %s", w.Code, w.Body.String())
	}
}
func TestBadInputDoesNotMutate(t *testing.T) {
	s := testStore(t)
	h := newHandler(s, t.TempDir())
	cases := []struct {
		path, body string
		status     int
	}{
		{"/assignments", `{`, 400}, {"/assignments", `null`, 422},
		{"/assignments", `{"revision":1,"personId":"ana","day":0,"shift":"morning","extra":true}`, 400},
		{"/assignments", `{"revision":1,"personId":"ana","day":0,"shift":"morning"} {}`, 400},
		{"/assignments", `{"revision":1,"personId":"ana","day":0.5,"shift":"morning"}`, 400},
		{"/assignments", `{"revision":1,"personId":"ana","day":7,"shift":"morning"}`, 422},
		{"/assignments", `{"revision":1,"personId":"ana","shift":"morning"}`, 422},
		{"/assignments", `{"revision":1,"personId":"unknown","day":0,"shift":"morning"}`, 422},
		{"/assignments", `{"revision":1,"personId":"ana","day":0,"shift":"night"}`, 422},
		{"/assignments", `{"revision":0,"personId":"ana","day":0,"shift":"off"}`, 422},
		{"/assignments", `{"revision":9007199254740992,"personId":"ana","day":0,"shift":"off"}`, 422},
	}
	for _, tc := range cases {
		w := call(t, h, "PATCH", basePath+tc.path, tc.body)
		if w.Code != tc.status {
			t.Errorf("%s => %d want %d: %s", tc.body, w.Code, tc.status, w.Body.String())
		}
	}
	for _, shifts := range []string{`null`, `["off"]`, `["morning","morning"]`, `["morning","afternoon","morning"]`} {
		w := call(t, h, "PUT", basePath+"/availability", `{"revision":1,"personId":"ana","day":0,"shifts":`+shifts+`}`)
		if w.Code != 422 {
			t.Errorf("%s: %d", shifts, w.Code)
		}
	}
	if s.Get().Revision != 1 {
		t.Fatal("bad request mutated state")
	}
}
func TestBodyLimitMethodsOriginsAndHost(t *testing.T) {
	s := testStore(t)
	h := newHandler(s, t.TempDir())
	w := call(t, h, "PATCH", basePath+"/assignments", strings.Repeat(" ", 65537))
	if w.Code != 413 {
		t.Fatal(w.Code)
	}
	w = call(t, h, "POST", basePath, `{}`)
	if w.Code != 405 || w.Header().Get("Allow") != "GET, PUT" {
		t.Fatal(w.Code)
	}
	w = call(t, h, "GET", "/api/weeks/2026-11-09", "")
	if w.Code != 404 {
		t.Fatal(w.Code)
	}
	for _, tc := range []struct {
		host, origin, content string
		status                int
	}{
		{"localhost", "http://evil.example", "application/json", 403},
		{"localhost", "null", "application/json", 403},
		{"localhost", "https://localhost", "application/json", 403},
		{"evil.example", "", "application/json", 403},
		{"localhost", "", "text/plain", 415},
	} {
		r := httptest.NewRequest("POST", "http://"+tc.host+basePath+"/reset", strings.NewReader(`{"revision":1}`))
		r.Header.Set("Origin", tc.origin)
		r.Header.Set("Content-Type", tc.content)
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		if w.Code != tc.status {
			t.Errorf("%+v: %d", tc, w.Code)
		}
	}
	if s.Get().Revision != 1 {
		t.Fatal("rejected request mutated state")
	}
}
func TestConcurrentRequestsOnlyOneRevisionWins(t *testing.T) {
	s := testStore(t)
	server := httptest.NewServer(newHandler(s, t.TempDir()))
	defer server.Close()
	var wg sync.WaitGroup
	results := make(chan int, 12)
	for i := 0; i < 12; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			req, _ := http.NewRequest("PATCH", server.URL+basePath+"/assignments", strings.NewReader(`{"revision":1,"personId":"davi","day":6,"shift":"afternoon"}`))
			req.Header.Set("Content-Type", "application/json")
			resp, err := server.Client().Do(req)
			if err != nil {
				results <- 0
				return
			}
			defer resp.Body.Close()
			_, _ = io.Copy(io.Discard, resp.Body)
			results <- resp.StatusCode
		}()
	}
	wg.Wait()
	close(results)
	success, conflict := 0, 0
	for code := range results {
		switch code {
		case 200:
			success++
		case 409:
			conflict++
		default:
			t.Errorf("unexpected status %d", code)
		}
	}
	if success != 1 || conflict != 11 || s.Get().Revision != 2 {
		t.Fatalf("success %d conflict %d revision %d", success, conflict, s.Get().Revision)
	}
}
func TestPersistenceRestartAndSingleProcessLock(t *testing.T) {
	path := filepath.Join(t.TempDir(), "data", "week.json")
	s, err := openStore(path)
	if err != nil {
		t.Fatal(err)
	}
	if other, err := openStore(path); err == nil {
		other.Close()
		t.Fatal("second process lock admitted")
	}
	_, err = s.Update(1, func(s *State) error { s.Assignments["davi"][6] = "afternoon"; return nil })
	if err != nil {
		t.Fatal(err)
	}
	s.Close()
	s, err = openStore(path)
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	if s.Get().Revision != 2 || s.Get().Assignments["davi"][6] != "afternoon" {
		t.Fatal("state lost after restart")
	}
	info, _ := os.Stat(path)
	if info.Mode().Perm() != 0600 {
		t.Fatalf("permissions %v", info.Mode())
	}
	files, _ := filepath.Glob(filepath.Join(filepath.Dir(path), ".turno-*.tmp"))
	if len(files) != 0 {
		t.Fatal("orphan temp files", files)
	}
}
func TestCorruptStoreFailsClosed(t *testing.T) {
	for _, content := range []string{`not json`, `null`, `{"version":2}`, strings.Repeat("x", 65537)} {
		path := filepath.Join(t.TempDir(), "week.json")
		if err := os.WriteFile(path, []byte(content), 0600); err != nil {
			t.Fatal(err)
		}
		s, err := openStore(path)
		if err == nil {
			s.Close()
			t.Fatal("corrupt state accepted")
		}
		got, _ := os.ReadFile(path)
		if string(got) != content {
			t.Fatal("corrupt file overwritten")
		}
		if _, err = os.Stat(path + ".lock"); !errors.Is(err, os.ErrNotExist) {
			t.Fatal("failed open leaked lock")
		}
	}
}
func TestPersistenceFailureDoesNotAdvanceMemoryOrDisk(t *testing.T) {
	s := testStore(t)
	before, _ := os.ReadFile(s.path)
	s.persist = func(string, []byte) error { return errors.New("simulated full disk") }
	h := newHandler(s, t.TempDir())
	w := call(t, h, "PATCH", basePath+"/assignments", `{"revision":1,"personId":"davi","day":6,"shift":"afternoon"}`)
	if w.Code != 500 || s.Get().Revision != 1 || s.Get().Assignments["davi"][6] != "off" {
		t.Fatal(w.Code, s.Get())
	}
	after, _ := os.ReadFile(s.path)
	if !bytes.Equal(before, after) {
		t.Fatal("disk changed on failure")
	}
}
func TestSnapshotsAndInvalidMutationAreIsolated(t *testing.T) {
	s := testStore(t)
	snapshot := s.Get()
	snapshot.Assignments["ana"][0] = "off"
	snapshot.Availability["ana"]["5"][0] = "off"
	if s.Get().Assignments["ana"][0] != "morning" || s.Get().Availability["ana"]["5"][0] != "morning" {
		t.Fatal("snapshot aliases store")
	}
	_, err := s.Update(1, func(next *State) error { next.Assignments["ana"][0] = "invalid"; return nil })
	if err == nil || s.Get().Revision != 1 {
		t.Fatal("invalid mutation committed")
	}
}
func TestStaticFrontendAndHealth(t *testing.T) {
	s := testStore(t)
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, "index.html"), []byte("<h1>Turno</h1>"), 0600)
	h := newHandler(s, dir)
	w := call(t, h, "GET", "/?mode=api", "")
	if w.Code != 200 || !strings.Contains(w.Body.String(), "Turno") {
		t.Fatal(w.Code, w.Body.String())
	}
	w = call(t, h, "GET", "/api/health", "")
	if w.Code != 200 || !strings.Contains(w.Body.String(), "local-demo") {
		t.Fatal(w.Code)
	}
	w = call(t, h, "GET", "/.secret", "")
	if w.Code != 404 {
		t.Fatal(w.Code)
	}
}
func Example_analyze() {
	r := analyze(demo())
	fmt.Printf("coverage=%d/%d hours=%d conflicts=%d\n", r.Covered, r.Total, r.TotalHours, len(r.Conflicts)) // Output: coverage=12/14 hours=104 conflicts=1
}

func TestClosedStoreRejectsUpdates(t *testing.T) {
	s := testStore(t)
	if err := s.Close(); err != nil {
		t.Fatal(err)
	}
	_, err := s.Update(1, func(next *State) error { next.Assignments["ana"][0] = "off"; return nil })
	if !errors.Is(err, ErrClosed) || s.Get().Revision != 1 {
		t.Fatal("closed store mutated", err)
	}
}
