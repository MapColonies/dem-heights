/* eslint-disable */
export default [
    {
        __typename: "LayerDemRecord",
        id: "11111111-1111-1111-1111-111111111111",
        type: "RECORD_DEM",
        classification: "5",
        productName: "srtm100",
        description: null,
        srsId: "EPSG:4326",
        srsName: "WGS84GEO",
        producerName: "IDFMU",
        updateDate: "2023-04-21T23:44:41.000Z",
        sourceDateStart: "2023-04-21T00:00:00.000Z",
        sourceDateEnd: "2023-04-21T00:00:00.000Z",
        sensors: ["UNDEFINED"],
        region: ["Israel"],
        productId: "11111111-1111-1111-1111-111111111111",
        productType: "QUANTIZED_MESH_DTM_BEST",
        footprint: {
            type: "Polygon",
            coordinates: [
                [
                    [34.999861111, 31.999861111],
                    [34.999861111, 33.000138889],
                    [36.000138889, 33.000138889],
                    [36.000138889, 31.999861111],
                    [34.999861111, 31.999861111]
                ]
            ]
        },
        absoluteAccuracyLEP90: 9e-7,
        relativeAccuracyLEP90: 9e-7,
        resolutionDegree: 0.00833,
        resolutionMeter: 100,
        imagingSortieAccuracyCEP90: 30,
        layerPolygonParts: null,
        productBoundingBox: null,
        heightRangeFrom: -500,
        heightRangeTo: 9000,
        geographicArea: "North",
        undulationModel: "ILUM",
        dataType: "INT16",
        noDataValue: "NO_DATA_999",
        productStatus: "PUBLISHED",
        hasTerrain: true,
        insertDate: "2023-04-21T00:00:00.000Z",
        wktGeometry: null,
        keywords: "North, terrain, EPSG:4326",
        links: [
            {
                __typename: "Link",
                name: "",
                description: "",
                protocol: "TERRAIN_QMESH",
                url: "https://dem-int-proxy-production-nginx-s3-gateway-route-integration.apps.j1lk3njp.eastus.aroapp.io/terrains/srtm100"
            }
        ]
    },
    {
        __typename: "LayerDemRecord",
        id: "2222222222222222222222-222222222222222222222-2222222222222222",
        type: "RECORD_DEM",
        classification: "5",
        productName: "srtm100",
        description: null,
        srsId: "EPSG:4326",
        srsName: "WGS84GEO",
        producerName: "IDFMU",
        updateDate: "2023-04-21T23:44:41.000Z",
        sourceDateStart: "2023-04-21T00:00:00.000Z",
        sourceDateEnd: "2023-04-21T00:00:00.000Z",
        sensors: ["UNDEFINED"],
        region: ["Israel"],
        productId: "2222222222222222222222-222222222222222222222-2222222222222222",
        productType: "QUANTIZED_MESH_DTM_BEST",
        footprint: {
            type: "Polygon",
            coordinates: [
                [
                    [34.999861111, 31.999861111],
                    [34.999861111, 33.000138889],
                    [36.000138889, 33.000138889],
                    [36.000138889, 31.999861111],
                    [34.999861111, 31.999861111]
                ]
            ]
        },
        absoluteAccuracyLEP90: 9e-7,
        relativeAccuracyLEP90: 9e-7,
        resolutionDegree: 0.00833,
        resolutionMeter: 100,
        imagingSortieAccuracyCEP90: 30,
        layerPolygonParts: null,
        productBoundingBox: null,
        heightRangeFrom: -500,
        heightRangeTo: 9000,
        geographicArea: "North",
        undulationModel: "ILUM",
        dataType: "INT16",
        noDataValue: "NO_DATA_999",
        productStatus: "PUBLISHED",
        hasTerrain: true,
        insertDate: "2023-04-21T00:00:00.000Z",
        wktGeometry: null,
        keywords: "North, terrain, EPSG:4326",
        links: [
            {
                __typename: "Link",
                name: "",
                description: "",
                protocol: "TERRAIN_QMESH",
                url: "https://dem-int-proxy-production-nginx-s3-gateway-route-integration.apps.j1lk3njp.eastus.aroapp.io/terrains/srtm100"
            }
        ]
    }
];