import express, { NextFunction, Request, Response } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { MongoClient, ServerApiVersion, ObjectId } from 'mongodb';
dotenv.config();
import { jwtVerify, createRemoteJWKSet } from 'jose-cjs';

const mongodburi = process.env.MONGO_URI!;

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());

const client = new MongoClient(mongodburi, {
    serverApi: { 
        version: ServerApiVersion.v1,
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
        const productCollection = db.collection('products');

        const JWKS = createRemoteJWKSet(
            new URL(`${process.env.CLIENT_URL!}/api/auth/jwks`)
        );

        // Verify Token
        const verifyToken = async (request:Request, response:Response, next:NextFunction) => {
            const authHeader = request.headers.authorization;
            if (!authHeader) {
                return response.status(401).json({message: "Unauthorized"});
            }
            
            const token = authHeader.split(" ")[1];

            if (!token) {
                return response.status(401).json({ message: "Unauthorized" });
            }

            try {
                const { payload } = await jwtVerify(token, JWKS);
                console.log(payload);
                return next()
            } catch (error) {
                return response.status(403).json({message:"forbidden"})
            }
        }

        // Find all products for explore product page
        app.get('/digicraft-products', async (request:Request, response:Response) => {
            const result = await productCollection.find().toArray();
            response.json(result);
        });

        // Find single product
        app.get('/digicraft-product/:productId', async (request:Request, response:Response) => {
            const { productId } = request.params;
            const result = await productCollection.findOne({ _id: new ObjectId(productId) });
            response.json(result);
        });

        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);

// একটি সিম্পল রুট (Route)
app.get('/', (req: Request, res: Response) => {
    res.send('Typescript Server is Running Successfully!');
});

// Server Listening
app.listen(PORT, () => {
    console.log(`[server]: Server is running at http://localhost:${PORT}`);
});