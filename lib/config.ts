const config = {
  env: {
    apiEndpoint: process.env.NEXT_PUBLIC_API_ENDPOINT!,
    prodApiEndpoint: process.env.NEXT_PUBLIC_PROD_API_ENDPOINT!,
    imagekit: {
      publicKey: "public_hAib6V+2qHj3JDVcVNy7XKmh6Xg=",
      urlEndpoint: "https://ik.imagekit.io/jd5faewd2",
      privateKey: "private_qX4uPDrZb1oknp3WhMmwtrsNpgw=",
    },
    databaseUrl: process.env.DATABASE_URL!,
    upstash: {
      redisUrl: process.env.UPSTASH_REDIS_URL!,
      redisToken: process.env.UPSTASH_REDIS_TOKEN!,
      qstashUrl: process.env.QSTASH_URL!,
      qstashToken: process.env.QSTASH_TOKEN!,
    },
    resendToken: process.env.RESEND_TOKEN!,
  },
};

export default config;
