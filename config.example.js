const config = {
    channelId: "",
    channelSecret: "",
    channelAccessToken: "",
    db: {
        host: process.env.DATABASE_HOST || "postgres",
        port: 5432,
        user: "",
        password: "",
        database: "clinic_wait_bot_db"
    }
};

module.exports = { config };
