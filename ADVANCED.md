# Advanced Usage

This guide covers advanced features for developers integrating with Thinking Tracer.

## Loading Traces from a Local CLI

Thinking Tracer supports loading trace files directly from a local command-line tool. This enables workflows like:

```bash
my-cli view session.jsonl
# → Opens browser with trace visualization
```

### How It Works

1. Your CLI starts a local HTTP server serving the trace file
2. CLI opens the browser to Thinking Tracer with URL parameters
3. The viewer fetches the trace from your local server
4. The local server can shut down after the file is loaded

### URL Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `url` | Yes | URL to fetch the trace file from (e.g., `http://localhost:54321/trace.jsonl`) |
| `title` | No | Custom title for the session (URL-encoded) |
| `token` | No | Authentication token for secure local server access |

**Example URL:**
```
https://brain-stm-org.github.io/thinking-tracer/?url=http://localhost:54321/trace.jsonl&title=My%20Session&token=abc123
```

### Security

#### CORS Configuration

Your local server must include CORS headers to allow the viewer to fetch the trace:

```
Access-Control-Allow-Origin: https://brain-stm-org.github.io
Access-Control-Allow-Methods: GET, OPTIONS
Access-Control-Allow-Headers: Authorization
```

**Important:** Use a specific origin, not `*`. This prevents malicious websites from accessing your local server if it happens to be running.

#### Authentication Token

For additional security, generate a one-time token:

1. CLI generates a random token (e.g., 32 hex characters)
2. Token is included in the URL: `?token=abc123...`
3. Viewer sends token via HTTP header: `Authorization: Bearer abc123...`
4. Your server validates the token before serving the file

This prevents other browser tabs or scripts from accessing your trace data, even if they guess the port number.

### Implementation Example (Go)

```go
package main

import (
    "crypto/rand"
    "encoding/hex"
    "fmt"
    "net"
    "net/http"
    "os/exec"
    "runtime"
)

func main() {
    filepath := "session.jsonl"

    // Generate secure one-time token
    tokenBytes := make([]byte, 16)
    rand.Read(tokenBytes)
    token := hex.EncodeToString(tokenBytes)

    // Find available port
    listener, err := net.Listen("tcp", "127.0.0.1:0")
    if err != nil {
        panic(err)
    }
    port := listener.Addr().(*net.TCPAddr).Port

    // Configurable origin (could be a CLI flag)
    allowedOrigin := "https://brain-stm-org.github.io"

    http.HandleFunc("/trace.jsonl", func(w http.ResponseWriter, r *http.Request) {
        // Set CORS headers
        w.Header().Set("Access-Control-Allow-Origin", allowedOrigin)
        w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
        w.Header().Set("Access-Control-Allow-Headers", "Authorization")

        // Handle preflight
        if r.Method == "OPTIONS" {
            w.WriteHeader(http.StatusOK)
            return
        }

        // Validate token
        auth := r.Header.Get("Authorization")
        expected := "Bearer " + token
        if auth != expected {
            http.Error(w, "Unauthorized", http.StatusUnauthorized)
            return
        }

        // Serve the file
        http.ServeFile(w, r, filepath)
    })

    // Build viewer URL
    viewerURL := fmt.Sprintf(
        "%s/thinking-tracer/?url=http://localhost:%d/trace.jsonl&token=%s",
        allowedOrigin,
        port,
        token,
    )

    // Open browser
    openBrowser(viewerURL)

    fmt.Printf("Serving trace on http://localhost:%d\n", port)
    fmt.Println("Press Ctrl+C to stop")

    http.Serve(listener, nil)
}

func openBrowser(url string) {
    var cmd *exec.Cmd
    switch runtime.GOOS {
    case "darwin":
        cmd = exec.Command("open", url)
    case "linux":
        cmd = exec.Command("xdg-open", url)
    case "windows":
        cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
    }
    cmd.Start()
}
```

### Implementation Example (Python)

```python
import http.server
import secrets
import socket
import webbrowser
from urllib.parse import quote

def serve_trace(filepath: str, origin: str = "https://brain-stm-org.github.io"):
    # Generate one-time token
    token = secrets.token_hex(16)

    # Find available port
    sock = socket.socket()
    sock.bind(('127.0.0.1', 0))
    port = sock.getsockname()[1]
    sock.close()

    class Handler(http.server.BaseHTTPRequestHandler):
        def do_OPTIONS(self):
            self.send_response(200)
            self.send_header('Access-Control-Allow-Origin', origin)
            self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Authorization')
            self.end_headers()

        def do_GET(self):
            # Validate token
            auth = self.headers.get('Authorization', '')
            if auth != f'Bearer {token}':
                self.send_error(401, 'Unauthorized')
                return

            # Serve file
            self.send_response(200)
            self.send_header('Access-Control-Allow-Origin', origin)
            self.send_header('Content-Type', 'application/x-ndjson')
            self.end_headers()

            with open(filepath, 'rb') as f:
                self.wfile.write(f.read())

        def log_message(self, format, *args):
            pass  # Suppress logging

    # Open browser
    viewer_url = f"{origin}/thinking-tracer/?url=http://localhost:{port}/trace.jsonl&token={token}"
    webbrowser.open(viewer_url)

    print(f"Serving trace on http://localhost:{port}")
    print("Press Ctrl+C to stop")

    server = http.server.HTTPServer(('127.0.0.1', port), Handler)
    server.serve_forever()

if __name__ == '__main__':
    import sys
    serve_trace(sys.argv[1] if len(sys.argv) > 1 else 'trace.jsonl')
```

### Implementation Example (Node.js)

```javascript
const http = require('http');
const fs = require('fs');
const crypto = require('crypto');
const { exec } = require('child_process');

function serveTrace(filepath, origin = 'https://brain-stm-org.github.io') {
  // Generate one-time token
  const token = crypto.randomBytes(16).toString('hex');

  const server = http.createServer((req, res) => {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    // Validate token
    const auth = req.headers.authorization || '';
    if (auth !== `Bearer ${token}`) {
      res.writeHead(401);
      res.end('Unauthorized');
      return;
    }

    // Serve file
    res.setHeader('Content-Type', 'application/x-ndjson');
    fs.createReadStream(filepath).pipe(res);
  });

  server.listen(0, '127.0.0.1', () => {
    const port = server.address().port;
    const viewerUrl = `${origin}/thinking-tracer/?url=http://localhost:${port}/trace.jsonl&token=${token}`;

    // Open browser
    const cmd = process.platform === 'darwin' ? 'open'
              : process.platform === 'win32' ? 'start'
              : 'xdg-open';
    exec(`${cmd} "${viewerUrl}"`);

    console.log(`Serving trace on http://localhost:${port}`);
    console.log('Press Ctrl+C to stop');
  });
}

serveTrace(process.argv[2] || 'trace.jsonl');
```

### Viewer Behavior

When loading from a local server, the viewer:

1. **Shows loading state** - Displays "Loading from local server..." while connecting
2. **Retries automatically** - If the server isn't ready yet (race condition when browser opens before server starts), the viewer retries up to 10 times with 300ms delays
3. **Cleans up URL** - After successful load, query parameters (including the token) are removed from the browser's address bar for security
4. **Shows clear errors** - If connection fails, displays "Could not connect to local server. Make sure the CLI is still running."

### Recommended CLI Flags

Consider supporting these flags in your CLI:

```
--origin <url>    CORS origin to allow (default: https://brain-stm-org.github.io)
--port <port>     Use specific port instead of random
--no-browser      Don't open browser automatically (just print URL)
--title <name>    Custom title for the session
```

### Troubleshooting

**"Could not connect to local server"**
- Ensure your CLI server is still running
- Check that the port isn't blocked by a firewall
- Verify the server is binding to `127.0.0.1` or `localhost`

**"Authentication failed"**
- The token in the URL doesn't match what the server expects
- Check that the Authorization header is being sent correctly

**CORS errors in browser console**
- Ensure `Access-Control-Allow-Origin` matches exactly (including https vs http)
- Make sure `Access-Control-Allow-Headers` includes `Authorization`
- Verify the OPTIONS preflight request returns 200

**Browser doesn't open**
- Try the `--no-browser` flag and open the printed URL manually
- Check if your system's default browser is configured correctly
