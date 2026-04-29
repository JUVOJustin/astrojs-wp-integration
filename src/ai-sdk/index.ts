/**
 * Astro-specific AI SDK helpers plus pass-through exports from fluent-wp-client.
 */
export {
  createAbilityTools,
  deleteContentTool,
  deleteResourceTool,
  deleteTermTool,
  describeResourceTool,
  executeDeleteAbilityTool,
  executeGetAbilityTool,
  executeRunAbilityTool,
  getAbilitiesTool,
  getAbilityTool,
  getBlocksTool,
  getContentCollectionTool,
  getContentTool,
  getResourceCollectionTool,
  getResourceTool,
  getSettingsTool,
  getTermCollectionTool,
  getTermTool,
  saveContentTool,
  saveResourceTool,
  saveTermTool,
  setBlocksTool,
  updateSettingsTool,
} from 'fluent-wp-client/ai-sdk';

export type {
  AbilityToolFactoryOptions,
  BlocksGetToolOptions,
  BlocksSetToolOptions,
  CatalogMutationToolFactoryOptions,
  CatalogToolFactoryOptions,
  ContentCollectionToolOptions,
  ContentDeleteToolOptions,
  ContentGetToolOptions,
  ContentItemResult,
  ContentSaveToolOptions,
  CreateAbilityToolsOptions,
  DescribeResourceResourceKind,
  DescribeResourceToolInclude,
  DescribeResourceToolOptions,
  GenericMutationToolFactoryOptions,
  GenericResourceToolFactoryOptions,
  MutationToolFactoryOptions,
  ResourceCollectionToolOptions,
  ResourceDeleteToolOptions,
  ResourceGetToolOptions,
  ResourceSaveToolOptions,
  SettingsGetToolOptions,
  TermCollectionToolOptions,
  TermDeleteToolOptions,
  TermGetToolOptions,
  TermSaveToolOptions,
  ToolFactoryOptions,
  WordPressAIToolErrorResult,
} from 'fluent-wp-client/ai-sdk';

export {
  getLiveContentCollectionTool,
  getLiveContentTool,
} from './live-content';

export type {
  AstroLiveContentCollectionToolOptions,
  AstroLiveContentToolOptions,
} from './live-content';
