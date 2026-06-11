const { redisClient } = require("../config/redisClient");
const logger = require("../utils/logger/logger");

// module.exports.cacheMiddleware = (ttl = 60) => {
//     return async (req, res, next) => {
//         try {
//             const key = req.originalUrl; // unique for each URL

//             const cached = await redisClient.get(key);

//             if (cached) {
//                 logger.info(` Cache HIT for: ${key}`);
//                 return res.status(200).json(JSON.parse(cached));
//             }

//             logger.info(` Cache MISS for: ${key}`);

//             // Override res.json to save response before sending
//             const originalJson = res.json.bind(res);
//             res.json = (data) => {
//                 redisClient.setEx(key, ttl, JSON.stringify(data));
//                 return originalJson(data);
//             };

//             next();
//         } catch (err) {
//             logger.error("Redis Cache Error", err);
//             next();
//         }
//     };
// };



module.exports.cacheMiddleware = (ttl = 60) => {
    return async (req, res, next) => {
        const start = Date.now(); // Start timing
        try {
            const key = req.originalUrl; // unique for each URL

            const cached = await redisClient.get(key);

            if (cached) {
                const duration = Date.now() - start;
                logger.info(` Cache HIT for: ${key} | Response time: ${duration} ms`);
                return res.status(200).json(JSON.parse(cached));
            }

            logger.info(` Cache MISS for: ${key}`);

            // Override res.json to save response before sending
            const originalJson = res.json.bind(res);
            res.json = (data) => {
                const duration = Date.now() - start;
                redisClient.setEx(key, ttl, JSON.stringify(data));
                logger.info(` Response saved to cache for: ${key} | Total time: ${duration} ms`);
                return originalJson(data);
            };

            next();
        } catch (err) {
            logger.error("Redis Cache Error", err);
            next();
        }
    };
};
