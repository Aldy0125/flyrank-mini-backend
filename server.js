const http = require('http');

const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');

    // Endpoint 1: GET /
    if (req.url === '/' && req.method === 'GET') {
        res.writeHead(200);
        res.end(JSON.stringify({ message: "Welcome to FlyRank Backend AI Engineering Track!" }));
    } 
    // Endpoint 2: GET /status
    else if (req.url === '/status' && req.method === 'GET') {
        res.writeHead(200);
        res.end(JSON.stringify({ status: "Active", intern: "Aldy Putra Manurung", track: "Backend AI Engineering" }));
    } 
    // Handle 404 Not Found
    else {
        res.writeHead(404);
        res.end(JSON.stringify({ error: "Endpoint not found" }));
    }
});

server.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
});