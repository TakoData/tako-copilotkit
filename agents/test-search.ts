import "dotenv/config";
import { searchTakoCharts } from "./src/search";
import { searchTavilyWeb } from "./src/tavily";

async function testSearch() {
  const query = "nvidia financial metrics";

  console.log(`\n🔍 Testing search for: "${query}"\n`);
  console.log("=" .repeat(60));

  console.log("\n⏱️  Running parallel searches...\n");

  const startTime = Date.now();

  // Run searches in parallel (same as the actual implementation)
  const [takoResults, tavilyResults] = await Promise.all([
    searchTakoCharts(query, 3),
    searchTavilyWeb(query, 3)
  ]);

  const endTime = Date.now();

  console.log(`✅ Search completed in ${endTime - startTime}ms\n`);
  console.log("=" .repeat(60));

  // Display Tako results
  console.log(`\n📊 Tako Charts Found: ${takoResults.length}\n`);
  takoResults.forEach((result, index) => {
    console.log(`${index + 1}. ${result.title}`);
    console.log(`   Source: ${result.source}`);
    console.log(`   URL: ${result.url}`);
    console.log(`   Card ID: ${result.card_id}`);
    console.log();
  });

  // Display Tavily results
  console.log("=" .repeat(60));
  console.log(`\n🌐 Tavily Web Results Found: ${tavilyResults.length}\n`);
  tavilyResults.forEach((result, index) => {
    console.log(`${index + 1}. ${result.title}`);
    console.log(`   URL: ${result.url}`);
    console.log(`   Content preview: ${result.content.substring(0, 150)}...`);
    console.log();
  });

  console.log("=" .repeat(60));
  console.log(`\n📈 Summary:`);
  console.log(`   Total resources found: ${takoResults.length + tavilyResults.length}`);
  console.log(`   - Tako charts: ${takoResults.length}`);
  console.log(`   - Web results: ${tavilyResults.length}`);
  console.log(`   - Execution time: ${endTime - startTime}ms`);
  console.log();
}

testSearch().catch(console.error);
