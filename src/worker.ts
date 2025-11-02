export default {
  fetch() {
    return new Response("Hello from GitHub → Worker CI!", { status: 200 });
  }
} satisfies ExportedHandler;
