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
        const purchaseCollection = db.collection('purchases');

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

        // Find featured products
        app.get('/featured-products', async (request:Request, response:Response) => {
            try {
                const result = await productCollection
                    .find().sort({ createdAt: -1 }) // newest first
                    .limit(4)
                    .toArray();

                response.json(result);

            } catch (error) {
                console.error(error);

                response.status(500).json({
                    success: false,
                    message: 'Failed to fetch featured ebooks'
                });
            }
        });

        // Insert single product
        app.post('/digicraft-product', async (request:Request, response:Response) => {
            const productData = request.body;
            const finalProductData = {
                ...productData,
                createdAt: new Date()
            };
            const result = await productCollection.insertOne(finalProductData);
            response.json(result);
        });

        // Delete single product
        app.delete('/digicraft-product/:productId', async (request: Request, response: Response) => {
            const { productId } = request.params;
            const result = await productCollection.deleteOne({ _id: new ObjectId(productId) });
            response.json(result);
        });

        // Insert single purchase
        app.post('/purchase', async (request:Request, response:Response) => {
            const { productId, productTitle, imageUrl, totalAmount, downloadUrl, sellerId, buyerId } = request.body;

            const purchaseData = {
                productId,
                productTitle,
                imageUrl,
                totalAmount,
                downloadUrl,
                sellerId,
                buyerId,
                purchaseDate: new Date()
            };

            const isPurchaseExist = await purchaseCollection.findOne({
                productId,
                buyerId
            });

            if (isPurchaseExist) {
                return response.send({
                    success: false,
                    message: "Already Purchased"
                });
            }

            const purchaseResponse = await purchaseCollection.insertOne(purchaseData);

            return response.send({
                success: true,
                purchaseInsertedId: purchaseResponse.insertedId,
            });
        });

        // Find all purchase history for a specific user
        app.get('/purchase-history/:buyerId', async (request, response) => {
            const { buyerId } = request.params;
            const result = await purchaseCollection.find({
                buyerId
            }).toArray();
            response.send(result);
        });

        // Find dashboard analytics
        app.get('/analytics', async (request:Request, response:Response) => {
            try {
                // Purchase history
                const purchases = await purchaseCollection.find().toArray();

                const totalProductsSold = purchases.length;

                // Total Cumulative Revenue
                const totalRevenue = purchases.reduce(
                    (sum, purchase) => sum + Number(purchase.price || purchase.totalAmount || 0),
                    0
                );

                // Product Distribution by Category
                const categoryStats = await productCollection.aggregate([
                    {
                        $group: {
                            _id: '$category',
                            count: { $sum: 1 }
                        }
                    }
                ]).toArray();

                // Last 7 Months Sales Volume
                const now = new Date();
                const startDate = new Date(
                    now.getFullYear(),
                    now.getMonth() - 6,
                    1
                );

                const monthlySalesRaw = await purchaseCollection.aggregate([
                    {
                        $match: {
                            purchaseDate: {
                                $gte: startDate
                            }
                        }
                    },
                    {
                        $group: {
                            _id: {
                                year: { $year: '$purchaseDate' },
                                month: { $month: '$purchaseDate' }
                            },
                            revenue: {
                                $sum: { $ifNull: ['$price', '$totalAmount'] }
                            }
                        }
                    },
                    {
                        $sort: {
                            '_id.year': 1,
                            '_id.month': 1
                        }
                    }
                ]).toArray();

                const monthNames = [
                    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
                ];

                const monthlySales = [];

                // Last 7 months data
                for (let i = 6; i >= 0; i--) {
                    const date = new Date(
                        now.getFullYear(),
                        now.getMonth() - i,
                        1
                    );

                    const year = date.getFullYear();
                    const month = date.getMonth() + 1;

                    const found = monthlySalesRaw.find(
                        item => item._id.year === year && item._id.month === month
                    );

                    monthlySales.push({
                        month: monthNames[month - 1],
                        revenue: found ? parseFloat(found.revenue.toFixed(2)) : 0
                    });
                }

                // ফ্রন্টএন্ডের প্রত্যাশিত ফরম্যাট অনুযায়ী রেসপন্স পাঠানো হচ্ছে
                response.json({
                    metrics: {
                        totalProductsSold,
                        totalRevenue
                    },
                    categoryData: categoryStats.map(item => ({
                        category: item._id || 'Uncategorized',
                        count: item.count
                    })),
                    monthlySales
                });

            } catch (error) {
                console.error("Analytics Generation Error: ", error);
                response.status(500).json({
                    message: 'Failed to load system analytics'
                });
            }
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


app.get('/', (req: Request, res: Response) => {
    res.send('Typescript Server is Running Successfully!');
});

// Server Listening
app.listen(PORT, () => {
    console.log(`[server]: Server is running at http://localhost:${PORT}`);
});