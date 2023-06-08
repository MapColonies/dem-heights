import { container } from "tsyringe";
import config from "config";
import { PycswDemCatalogRecord } from "@map-colonies/mc-model-types";
import jsLogger from "@map-colonies/js-logger";
import { SERVICES } from "../../src/common/constants";
import DEMTerrainCacheManager from "../../src/heights/models/DEMTerrainCacheManager";
import { CATALOG_RECORDS_MAP, DEM_TERRAIN_CACHE_MANAGER } from "../../src/containerConfig";

async function registerTestValues(): Promise<void> {
    const demTerrainCacheManager = new DEMTerrainCacheManager(config);
    await demTerrainCacheManager.initTerrainProviders();

    const catalogRecordsMap = Object.fromEntries(
        (JSON.parse(config.get<string>("demCatalogRecords")) as PycswDemCatalogRecord[]).map(
            (record) => [record.id as string, record]
        )
    );

    container.register(SERVICES.CONFIG, { useValue: config });
    container.register(SERVICES.LOGGER, { useValue: jsLogger({ enabled: false }) });
    container.register(CATALOG_RECORDS_MAP, { useValue: catalogRecordsMap });
    container.register(DEM_TERRAIN_CACHE_MANAGER, { useValue: demTerrainCacheManager });
}

export { registerTestValues };
