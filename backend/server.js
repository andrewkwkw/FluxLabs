import express from 'express';
import sqlite3 from 'sqlite3';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration from Environment Variables
const isMock = process.env.MOCK === 'true';
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || "https://n8n.avatara.id/webhook/fluxlabs";
// Default to ngrok if not set (development convenience), but should ideally comes from env
let CALLBACK_URL = process.env.CALLBACK_URL || "https://arie-diversiform-hilde.ngrok-free.dev/api/webhook/n8n/callback";

console.log('[INIT] Configuration loaded:');
console.log(`- MOCK Mode: ${isMock}`);
console.log(`- N8N Webhook: ${N8N_WEBHOOK_URL}`);
console.log(`- Callback URL: ${CALLBACK_URL}`);

console.log('[INIT] Raw CALLBACK_URL before PUBLIC_HOST derivation:', CALLBACK_URL);

// Extract public host from CALLBACK_URL
// This is used for constructing public URLs for uploaded content,
// ensuring it uses the external URL (e.g., ngrok) rather than localhost.
let PUBLIC_HOST = 'https://arie-diversiform-hilde.ngrok-free.dev'; // Default fallback
try {
  const callbackUrlObj = new URL(CALLBACK_URL);
  PUBLIC_HOST = `${callbackUrlObj.protocol}//${callbackUrlObj.host}`;
} catch (e) {
  console.error('[WARN] Could not parse CALLBACK_URL to determine PUBLIC_HOST, defaulting to localhost:3001', e);
  PUBLIC_HOST = 'http://localhost:3001';
}
console.log('[INIT] PUBLIC_HOST for content uploads:', PUBLIC_HOST);

const app = express();
const NODE_ENV = process.env.NODE_ENV || 'development';
const PORT = parseInt(process.env.PORT || '3001', 10);
const SECRET_KEY = process.env.SECRET_KEY || 'fluxlabs-secret-key-change-this-in-production';
const MOCK_DELAY = 5000;
const sqlite3Verbose = sqlite3.verbose;

// Parse ALLOWED_ORIGINS from environment
const getAllowedOrigins = () => {
  if (!process.env.ALLOWED_ORIGINS) {
    // Development mode - allow localhost
    if (NODE_ENV === 'development') {
      return ['https://arie-diversiform-hilde.ngrok-free.dev', 'http://localhost:3000', 'http://127.0.0.1:3001'];
    }
    // Production mode - be restrictive
    return ['https://arie-diversiform-hilde.ngrok-free.dev'];
  }
  // Parse comma-separated origins
  return process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim());
};

const allowedOrigins = getAllowedOrigins();
const corsOptions = {
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, etc)
    if (!origin) return callback(null, true);
    
    if (NODE_ENV === 'development' || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

// Static file serving for uploaded images
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR);
}
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '1d' }));

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' })); // Limit besar untuk upload gambar base64

// === SERVE FRONTEND (VITE BUILD) ===
const distPath = path.resolve(__dirname, '../frontend/dist');

console.log('[INIT] Serving static files from:', distPath);
console.log('[INIT] dist folder exists:', fs.existsSync(distPath));

// Read index.html once at startup
const indexHtmlPath = path.join(distPath, 'index.html');
let indexHtmlContent = '';
if (fs.existsSync(indexHtmlPath)) {
  try {
    indexHtmlContent = fs.readFileSync(indexHtmlPath, 'utf8');
    console.log(`[INIT] Loaded index.html (${indexHtmlContent.length} bytes)`);
  } catch (err) {
    console.error('[INIT] Failed to read index.html:', err);
  }
}

// Serve static files (CSS, JS, images)
app.use(express.static(distPath, { 
  maxAge: '1d',
  etag: false 
}));

// SPA fallback middleware - serve index.html for all non-API routes
app.use((req, res, next) => {
  // Skip API routes
  if (req.path.startsWith('/api')) {
    console.log(`[API] ${req.method} ${req.path}`);
    return next();
  }
  
  console.log(`[SPA] Serving request for ${req.path}`);
  
  if (indexHtmlContent) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(indexHtmlContent);
  } else {
    console.error('[SPA ERROR] index.html content not available');
    res.status(500).send('Error loading page');
  }
});


// Database Setup
const dbPath = path.resolve(__dirname, 'fluxlabs.db');
const db = new (sqlite3Verbose().Database)(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to the SQLite database: fluxlabs.db');
        initDb();
    }
});

// Initialize Tables
function initDb() {
    const schemaPath = path.resolve(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    db.exec(schema, (err) => {
        if (err) {
            console.error('Failed to initialize database schema:', err);
        } else {
            console.log('Database tables initialized.');
        }
    });
}

// --- ROUTES ---

// 1. REGISTER
app.post('/api/auth/register', (req, res) => {
    try {
        const { name, email, password } = req.body;
        
        if (!name || !email || !password) {
            return res.status(400).json({ message: 'Name, email, and password are required' });
        }

        const hashedPassword = bcrypt.hashSync(password, 8);
        const id = uuidv4();

        const sql = `INSERT INTO users (id, name, email, password) VALUES (?, ?, ?, ?)`;
        db.run(sql, [id, name, email, hashedPassword], function(err) {
            if (err) {
                console.error('[REGISTER ERROR]', err);
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(400).json({ message: 'Email already exists' });
                }
                return res.status(500).json({ message: err.message });
            }
            
            console.log(`[REGISTER SUCCESS] User ${id} created`);
            // Auto login setelah register
            const token = jwt.sign({ id: id }, SECRET_KEY, { expiresIn: '24h' });
            res.json({ user: { id, name, email, token } });
        });
    } catch (e) {
        console.error('[REGISTER CATCH ERROR]', e);
        res.status(500).json({ message: e.message });
    }
});

// 2. LOGIN
app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    
    const sql = `SELECT * FROM users WHERE email = ?`;
    db.get(sql, [email], (err, user) => {
        if (err) return res.status(500).json({ message: err.message });
        if (!user) return res.status(404).json({ message: 'User not found' });

        const passwordIsValid = bcrypt.compareSync(password, user.password);
        if (!passwordIsValid) return res.status(401).json({ message: 'Invalid password' });

        const token = jwt.sign({ id: user.id }, SECRET_KEY, { expiresIn: '24h' });
        res.json({ 
            user: { 
                id: user.id, 
                name: user.name, 
                email: user.email, 
                token 
            } 
        });
    });
});

// Middleware Authentikasi
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) return res.sendStatus(401);

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// 3. CREATE TASK
app.post('/api/tasks', authenticateToken, async (req, res) => { // Made async for file operations
    let { type, prompt, model, ratio, thumbnail_url } = req.body; // Use 'let' to reassign thumbnail_url
    const id = uuidv4();
    const created_at = Date.now();
    const status = 'PROCESSING'; // Default start processing

    let final_thumbnail_url = thumbnail_url; // Use a new variable for the URL to store/send

    if (type === 'image-to-video' && thumbnail_url && thumbnail_url.startsWith('data:image')) {
        try {
            const matches = thumbnail_url.match(/^data:image\/([A-Za-z]+);base64,(.+)$/);
            if (!matches || matches.length !== 3) {
                return res.status(400).json({ message: 'Invalid image data format' });
            }
            const ext = matches[1];
            const base64Data = matches[2];
            const buffer = Buffer.from(base64Data, 'base64');

            const filename = `${uuidv4()}.${ext}`;
            const imagePath = path.join(UPLOAD_DIR, filename);
            await fs.promises.writeFile(imagePath, buffer); // Use fs.promises for async file write

            console.log(`[Image Upload] Using PUBLIC_HOST: ${PUBLIC_HOST}`); // Add this log
            // Construct the public URL for the image
            const publicImageUrl = `${PUBLIC_HOST}/uploads/${filename}`;
            final_thumbnail_url = publicImageUrl;
            console.log(`[Image Upload] Saved image to: ${imagePath}, Public URL: ${publicImageUrl}`);

        } catch (error) {
            console.error('[Image Upload Error]', error);
            return res.status(500).json({ message: 'Failed to process image upload' });
        }
    }

    const sql = `INSERT INTO video_tasks (id, user_id, type, prompt, model, ratio, status, thumbnail_url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    db.run(sql, [id, req.user.id, type, prompt, model, ratio, status, final_thumbnail_url, created_at], function(err) {
        if (err) return res.status(500).json({ message: err.message });

        const newTask = { id, userId: req.user.id, type, prompt, model, ratio, status, thumbnailUrl: final_thumbnail_url, createdAt: created_at };
        res.json(newTask);

        // Process task in background
        processTask(id, req.user.id, type, prompt, model, ratio, final_thumbnail_url); // Pass the public URL
    });
});
// Helper function to process task
async function processTask(taskId, userId, type, prompt, model, ratio, thumbnail_url) {
    console.log(`[processTask] Starting for task ${taskId}, isMock=${isMock}`);
    console.log(`[processTask] Received thumbnail_url: ${thumbnail_url}`); // Add this log

    if (isMock) {
        // MOCK MODE: Simulasi generate dengan timeout
        console.log(`[MOCK] Processing task ${taskId}...`);
        setTimeout(() => {
            const resultUrl = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4";
            const updateSql = `UPDATE video_tasks SET status = 'COMPLETED', result_url = ? WHERE id = ?`;
            db.run(updateSql, [resultUrl, taskId], (err) => {
                if(err) console.error("Background process failed", err);
                else console.log(`[MOCK] Task ${taskId} completed.`);
            });
        }, MOCK_DELAY);
    } else {
        // PRODUCTION MODE: Kirim ke N8N webhook dengan format yang tepat
        console.log(`[N8N] Sending task ${taskId} to webhook: ${N8N_WEBHOOK_URL}`);

        // Build payload based on type (without callbackUrl - using Respond to Webhook pattern)
        let payload;

        if (type === 'text-to-video') {
            payload = {
                data: 'text-to-video',
                model: model || 'flamingo',
                ratio: ratio || '16:9',
                quantity: 1,
                prompt: prompt || '',
                jobId: taskId
            };
        } else if (type === 'image-to-video') {
            console.log(`[N8N Payload] Constructing for image-to-video. imageUrl will be: ${thumbnail_url}`); // Add this log
            payload = {
                data: 'image-to-video',
                model: model || 'flamingo',
                ratio: ratio || '16:9',
                quantity: 1,
                prompt: prompt || '',
                imageUrl: thumbnail_url || '',
                jobId: taskId
            };
        } else {
            // Default text-to-video
            payload = {
                data: 'text-to-video',
                model: model || 'flamingo',
                ratio: ratio || '16:9',
                quantity: 1,
                prompt: prompt || '',
                jobId: taskId
            };
        }
        
        // ASYNC MODE - Kirim ke N8N tanpa tunggu (video bisa >1 menit)
        // Persiapkan callback URL untuk N8N mengirim hasil
        // Tambahkan callback URL ke payload
        payload.callbackUrl = CALLBACK_URL;
        
        console.log(`[N8N] Payload:`, JSON.stringify(payload, null, 2));
        console.log(`[N8N] Calling webhook: ${N8N_WEBHOOK_URL}`);
        console.log(`[N8N] Callback URL: ${CALLBACK_URL}`);
        
        try {
            // Kirim request dengan timeout 5 detik saja untuk pengiriman payload
            // Jangan tunggu N8N finish processing - biarkan N8N callback dengan hasil
            const controller = new AbortController();
            const timeoutMs = 5000; // 5 second timeout
            const timeout = setTimeout(() => {
                console.log(`[N8N] Webhook delivery timeout after ${timeoutMs}ms (expected - N8N processes async)`);
                controller.abort();
            }, timeoutMs);
            
            console.log(`[N8N] Starting fetch to ${N8N_WEBHOOK_URL} with ${timeoutMs}ms timeout...`);
            
            try {
                const response = await fetch(N8N_WEBHOOK_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                    signal: controller.signal,
                    timeout: timeoutMs
                });
                
                clearTimeout(timeout);
                console.log(`[N8N] Webhook response status: ${response.status}`);
                
                if (response.ok || response.status === 202) {
                    console.log(`[N8N] Task ${taskId} sent to N8N successfully (async processing)`);
                    console.log(`[N8N] Waiting for N8N callback to ${CALLBACK_URL}...`);
                    // Task stays in PROCESSING status, tunggu N8N callback
                } else {
                    const responseText = await response.text();
                    console.error(`[N8N] Webhook returned status ${response.status}: ${responseText}`);
                    // Update task status to FAILED only if webhook itself failed
                    const updateSql = `UPDATE video_tasks SET status = 'FAILED' WHERE id = ?`;
                    db.run(updateSql, [taskId], (err) => {
                        if(err) console.error("Failed to update task status", err);
                        else console.log(`[N8N] Task ${taskId} marked as FAILED`);
                    });
                }
            } catch (fetchError) {
                clearTimeout(timeout);
                // Timeout atau connection error - tapi task tetap in PROCESSING
                // N8N mungkin masih processing di background
                if (fetchError.name === 'AbortError') {
                    console.log(`[N8N] Request aborted/timeout after ${timeoutMs}ms (OK - N8N processes async)`);
                    console.log(`[N8N] Task ${taskId} waiting for async callback...`);
                    // Task stays in PROCESSING - N8N akan callback nanti
                } else {
                    console.error(`[N8N] Connection error:`, fetchError.message);
                    console.log(`[N8N] Task ${taskId} still in PROCESSING - will retry via callback`);
                    // Task stays PROCESSING - error handling is on callback side
                }
            }
        } catch (error) {
            console.error(`[N8N] Error in task processing:`, error.message);
            console.log(`[N8N] Task ${taskId} will wait for callback or manual retry`);
            // Don't mark as failed - task stays PROCESSING for callback
        }
    }
}

// 4. GET TASKS
app.get('/api/tasks', authenticateToken, (req, res) => {
    const sql = `SELECT * FROM video_tasks WHERE user_id = ? ORDER BY created_at DESC`;
    db.all(sql, [req.user.id], (err, rows) => {
        if (err) return res.status(500).json({ message: err.message });
        
        // Mapping database columns to frontend types if needed (snake_case to camelCase)
        const tasks = rows.map(row => ({
            id: row.id,
            userId: row.user_id,
            type: row.type,
            prompt: row.prompt,
            model: row.model,
            ratio: row.ratio,
            status: row.status,
            resultUrl: row.result_url,
            thumbnailUrl: row.thumbnail_url,
            createdAt: row.created_at,
            trimStart: 0, 
            trimEnd: undefined 
        }));
        
        res.json(tasks);
    });
});

// 5. DELETE TASK
app.delete('/api/tasks/:id', authenticateToken, (req, res) => {
    const sql = `DELETE FROM video_tasks WHERE id = ? AND user_id = ?`;
    db.run(sql, [req.params.id, req.user.id], function(err) {
        if (err) return res.status(500).json({ message: err.message });
        res.json({ message: "Deleted" });
    });
});

// 6. N8N WEBHOOK CALLBACK - Endpoint untuk N8N mengirim hasil generate setelah processing selesai
app.post('/api/webhook/n8n/callback', (req, res) => {
    // Log full body untuk debug
    console.log(`[N8N Callback] Full request body:`, JSON.stringify(req.body, null, 2));
    
    // N8N kirim callback dengan jobId (yang adalah taskId kita) dan download_url
    const jobId = req.body.jobId || req.body.taskId;
    const status = req.body.status || 'COMPLETED';
    // Handle download_url dari berbagai lokasi - termasuk nested di content
    const result_url = req.body.download_url || 
                       req.body.downloadUrl || 
                       req.body.result_url || 
                       req.body.resultUrl || 
                       req.body.url || 
                       req.body.videoUrl ||
                       req.body.content?.download_url;  // Nested di content
    const error = req.body.error;
    
    console.log(`[N8N Callback] Parsed - jobId: ${jobId}, status: ${status}, result_url: ${result_url}`);
    
    if (!jobId) {
        return res.status(400).json({ message: "jobId or taskId is required" });
    }

    console.log(`[N8N Callback] Received callback for task ${jobId}, status: ${status}`);

    let updateSql, params;
    
    if (status === 'COMPLETED' && result_url) {
        updateSql = `UPDATE video_tasks SET status = 'COMPLETED', result_url = ? WHERE id = ?`;
        params = [result_url, jobId];
        console.log(`[N8N Callback] Task ${jobId} completed with URL: ${result_url}`);
    } else if (status === 'FAILED' || status === 'ERROR') {
        updateSql = `UPDATE video_tasks SET status = 'FAILED' WHERE id = ?`;
        params = [jobId];
        if (error) {
            console.error(`[N8N Callback] Task ${jobId} failed with error:`, error);
        }
    } else {
        updateSql = `UPDATE video_tasks SET status = ? WHERE id = ?`;
        params = [status, jobId];
    }

    db.run(updateSql, params, (err) => {
        if (err) {
            console.error("Failed to update task from webhook:", err);
            return res.status(500).json({ message: "Failed to update task" });
        }
        res.json({ message: "Task updated successfully", jobId: jobId });
    });
});

// --- PROJECT ENDPOINTS ---

// 7. SAVE PROJECT
app.post('/api/projects', authenticateToken, (req, res) => {
    const { name, clipsJson } = req.body;
    const id = uuidv4();
    const now = Date.now();
    
    const sql = `INSERT INTO projects (id, user_id, name, clips_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`;
    db.run(sql, [id, req.user.id, name, clipsJson, now, now], function(err) {
        if (err) return res.status(500).json({ message: err.message });
        res.json({ id, userId: req.user.id, name, clipsJson, createdAt: now, updatedAt: now });
    });
});

// 8. GET USER PROJECTS
app.get('/api/projects', authenticateToken, (req, res) => {
    const sql = `SELECT * FROM projects WHERE user_id = ? ORDER BY updated_at DESC`;
    db.all(sql, [req.user.id], (err, rows) => {
        if (err) return res.status(500).json({ message: err.message });
        const projects = rows.map(row => ({
            id: row.id,
            userId: row.user_id,
            name: row.name,
            clipsJson: row.clips_json,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        }));
        res.json(projects);
    });
});

// 8b. GET PROJECT BY ID
app.get('/api/projects/:id', authenticateToken, (req, res) => {
    const sql = `SELECT * FROM projects WHERE id = ? AND user_id = ?`;
    db.get(sql, [req.params.id, req.user.id], (err, row) => {
        if (err) return res.status(500).json({ message: err.message });
        if (!row) return res.status(404).json({ message: "Project not found" });
        const project = {
            id: row.id,
            userId: row.user_id,
            name: row.name,
            clipsJson: row.clips_json,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
        res.json(project);
    });
});

// 9. UPDATE PROJECT
app.put('/api/projects/:id', authenticateToken, (req, res) => {
    const { name, clipsJson } = req.body;
    const now = Date.now();
    
    const sql = `UPDATE projects SET name = ?, clips_json = ?, updated_at = ? WHERE id = ? AND user_id = ?`;
    db.run(sql, [name, clipsJson, now, req.params.id, req.user.id], function(err) {
        if (err) return res.status(500).json({ message: err.message });
        res.json({ message: "Project updated", id: req.params.id });
    });
});

// 10. DELETE PROJECT
app.delete('/api/projects/:id', authenticateToken, (req, res) => {
    const sql = `DELETE FROM projects WHERE id = ? AND user_id = ?`;
    db.run(sql, [req.params.id, req.user.id], function(err) {
        if (err) return res.status(500).json({ message: err.message });
        res.json({ message: "Project deleted" });
    });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT} (0.0.0.0)`);
});
