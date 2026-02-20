import type { Loader } from 'astro/loaders';
import { WordPressClient } from '../client';
import type { WordPressStaticLoaderConfig } from './types';

export function wordPressCustomPostStaticLoader(
  config: WordPressStaticLoaderConfig & { postType: string }
): Loader {
  const client = new WordPressClient(config);
  const methods = client.getCustomPostType(config.postType);

  return {
    name: `wordpress-${config.postType}-static-loader`,
    load: async ({ store, logger }) => {
      logger.info(`Loading all WordPress ${config.postType}...`);

      try {
        const items = await methods.getAllItems();
        store.clear();

        for (const item of items) {
          store.set({
            id: String(item.id),
            data: item,
            rendered: { html: item.content?.rendered || '' },
          });
        }

        logger.info(`Loaded ${items.length} ${config.postType}`);
      } catch (error) {
        logger.error(`Failed to load ${config.postType}: ${error}`);
        throw error;
      }
    },
  };
}
