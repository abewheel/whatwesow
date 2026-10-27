import { createServer } from "vite";
const args = process.argv.slice(2);
const instanceIndex = args.indexOf("--instance");
const instance =
  instanceIndex < 0 ? "default" : args.splice(instanceIndex, 2)[1];
if (!instance || !/^[a-z0-9-]+$/.test(instance))
  throw new Error(
    "Use a lowercase instance name with letters, digits, and hyphens.",
  );
const server = await createServer({
  server: {
    host: "127.0.0.1",
    port: instance === "default" ? 5173 : 5174,
    strictPort: false,
  },
});
await server.listen();
const address = server.httpServer.address();
console.log(`Ready: http://127.0.0.1:${address.port}/?instance=${instance}`);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, async () => {
    await server.close();
    process.exit(0);
  });
