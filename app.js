require("dotenv").config();
require("express-async-errors");

// extra security packages
const helmet = require("helmet");
const cors = require("cors");
const xss = require("xss-clean");
const rateLimiter = require("express-rate-limit");
const useragent = require("express-useragent");
const cookieParser = require("cookie-parser");

const express = require("express");
const app = express();

// connect DB
const connectDB = require("./db/connect");

// routers
const authRouter = require("./routes/authRoutes");
const foodRouter = require("./routes/foodRoutes");
const reivewRouter = require("./routes/reviewRoutes");
const orderRouter = require("./routes/orderRoutes");

// error handler
const notFoundMiddleware = require("./middleware/not-found");
const errorHandlerMiddleware = require("./middleware/error-handler");

app.set("trust proxy", 1);
// app.use(
// 	rateLimiter({
// 		windowMs: 15 * 60 * 1000, // 15 minutes
// 		max: 100, // limit each IP to 100 requests per windowMs
// 	})
// );
app.use(helmet());
app.use(
    cors({
        credentials: true,
        origin: [
            "https://rmit-what-to-eat.netlify.app",
            "http://localhost:3000",
        ], // only allow website in this domain too access the resource of this server
    })
);
// app.use(cors());
app.use(xss());
app.use(useragent.express());

app.use(express.json());
app.use(cookieParser());

const fileUpload = require("express-fileupload");
app.use(fileUpload({ useTempFiles: true }));

// config cloudinary V2
const cloudinary = require("cloudinary").v2;
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// routes
app.use("/api/auth", authRouter);
app.use("/api/food", foodRouter);
app.use("/api/review", reivewRouter);
app.use("/api/order", orderRouter);

app.use(notFoundMiddleware);
app.use(errorHandlerMiddleware);

// schedule computation jobs to be executed
const nodeCron = require("node-cron");

// every midnight the server will update the recommending foods for each user

const port = process.env.PORT || 8080;

const { verifySocketJWT } = require("./socket/socket.js");
const { connectedUsers } = require("./utils");

const start = async () => {
    try {
        await connectDB(process.env.MONGO_URI);
        const server = app.listen(port, () =>
            console.log(`Server is listening on port ${port}...`)
        );

        const io = require("socket.io")(server, {
            cors: {
                origin: [
                    "https://rmit-what-to-eat.netlify.app",
                    "http://localhost:3000",
                ],
            },
        });

        io.on("connection", (socket) => {
            socket.on("subscribe", async (userId) => {
                connectedUsers[userId] = socket;
            });
        });

        io.use(verifySocketJWT);

        app.io = io;
    } catch (error) {
        console.log(error);
    }
};

start();
