"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const cors_1 = __importDefault(require("cors"));
const mongodb_1 = require("mongodb");
const jose_cjs_1 = require("jose-cjs");
dotenv_1.default.config();
const mongodburi = process.env.MONGO_URI;
const app = (0, express_1.default)();
const PORT = Number(process.env.PORT) || 8000;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
const client = new mongodb_1.MongoClient(mongodburi, {
    serverApi: {
        version: mongodb_1.ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});
async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();
        // Create database and collections
        const db = client.db('digicraft');
        const ebookCollection = db.collection('ebooks');
        const bookmarkCollection = db.collection('bookmarks');
        const purchaseCollection = db.collection('purchases');
        const userCollection = db.collection('user');
        const transactionCollection = db.collection('transactions');
        const verifiedWriterCollection = db.collection('verified-writers');
        const JWKS = (0, jose_cjs_1.createRemoteJWKSet)(new URL(`${process.env.CLIENT_URL}/api/auth/jwks`));
        // Verify Token
        const verifyToken = async (request, response, next) => {
            const authHeader = request.headers.authorization;
            if (!authHeader) {
                return response.status(401).json({ message: "Unauthorized" });
            }
            const token = authHeader.split(" ")[1];
            if (!token) {
                return response.status(401).json({ message: "Unauthorized" });
            }
            try {
                const { payload } = await (0, jose_cjs_1.jwtVerify)(token, JWKS);
                console.log(payload);
                return next();
            }
            catch (error) {
                return response.status(403).json({ message: "forbidden" });
            }
        };
        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    }
    finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);
app.get('/', (request, response) => {
    response.send('Server is running fine');
});
app.listen(PORT, () => {
    console.log(`Server running on PORT ${PORT}`);
});
