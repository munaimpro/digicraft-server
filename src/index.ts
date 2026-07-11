import express, {Request, Response, NextFunction} from "express";
import dotenv from "dotenv";
import cors from "cors";
import { MongoClient, ServerApiVersion, ObjectId } from 'mongodb';
import { jwtVerify, createRemoteJWKSet } from 'jose-cjs';
dotenv.config();

const mongodburi = process.env.MONGO_URI as string;

const app = express();
const PORT = Number(process.env.PORT) || 8000;

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
        const ebookCollection = db.collection('ebooks');
        const bookmarkCollection = db.collection('bookmarks');
        const purchaseCollection = db.collection('purchases');
        const userCollection = db.collection('user');
        const transactionCollection = db.collection('transactions');
        const verifiedWriterCollection = db.collection('verified-writers');


        const JWKS = createRemoteJWKSet(
            new URL(`${process.env.CLIENT_URL}/api/auth/jwks`)
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

        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (request:Request, response:Response) => {
    response.send('Server is running fine')
})

app.listen(PORT, () => {
    console.log(`Server running on PORT ${PORT}`);
})