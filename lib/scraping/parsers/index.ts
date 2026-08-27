import { arxivParser } from "./arxiv";
import { genericBlogParser } from "./genericBlog";
import { githubTrendingParser } from "./githubTrending";
import { huggingfaceParser } from "./huggingface";
import { huggingfaceDatasetsParser } from "./huggingfaceDatasets";
import { huggingfaceModelsParser } from "./huggingfaceModels";
import { videoTalksParser } from "./videoTalks";
import type { SourceParser } from "./types";

const PARSER_REGISTRY: Record<string, SourceParser> = {
  arxiv: arxivParser,
  generic_blog: genericBlogParser,
  github_trending: githubTrendingParser,
  huggingface: huggingfaceParser,
  huggingface_datasets: huggingfaceDatasetsParser,
  huggingface_models: huggingfaceModelsParser,
  video_talks: videoTalksParser,
};

export function getParserForStrategy(strategy: string | null): SourceParser | null {
  if (!strategy) return null;
  return PARSER_REGISTRY[strategy] ?? null;
}
