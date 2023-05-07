import { BBox } from 'geojson';
import { AxiosError, AxiosInstance } from 'axios';
import { inject, injectable } from 'tsyringe';
import { getTraversalObj, convertToJson } from 'fast-xml-parser';
import { Logger } from '@map-colonies/js-logger';
import he from 'he';
// import { owsBoundingBoxToBbox } from '../common/util';
import { IConfig } from '../common/interfaces';
import { SERVICES } from '../common/constants';
import { UpstreamUnavailableError } from '../common/errors';

const options = {
  attributeNamePrefix: '',
  attrNodeName: 'attr',
  textNodeName: '#text',
  ignoreAttributes: false,
  ignoreNameSpace: false,
  allowBooleanAttributes: false,
  parseNodeValue: true,
  parseAttributeValue: false,
  trimValues: true,
  cdataTagName: '__cdata',
  cdataPositionChar: '\\c',
  parseTrueNumberOnly: false,
  numParseOptions: {
    hex: true,
    leadingZeros: true,
  },
  arrayMode: (name: string): boolean => name === 'mc:MCDEMRecord',
  attrValueProcessor: (val: string): string => he.decode(val, { isAttributeValue: true }),
  tagValueProcessor: (val: string): string => he.decode(val),
  alwaysCreateTextNode: false,
};

const NAMESPACES = {
  csw: 'http://www.opengis.net/cat/csw/2.0.2',
  ogc: 'http://www.opengis.net/ogc',
  gml: 'http://www.opengis.net/gml',
  ows: 'http://www.opengis.net/ows',
  mc: 'http://schema.mapcolonies.com/dem',
};

const namespaceString = Object.entries(NAMESPACES)
  .map(([key, value]) => `xmlns:${key}="${value}"`)
  .join(' ');

const generateCswBody = (
  bbox: BBox,
  sortOrder: 'DESC' | 'ASC',
  sortColumn: string,
  startPosition: number,
  maxRecords?: number
): string => `<csw:GetRecords xmlns="http://www.opengis.net/cat/csw/2.0.2" ${namespaceString} service="CSW" version="2.0.2" resultType="results" outputSchema="http://schema.mapcolonies.com/dem" startPosition="${startPosition}" ${maxRecords !== undefined ? `maxRecords="${maxRecords}"` : ''}>
  <csw:Query typeNames="csw:Record">
    <csw:ElementSetName>full</csw:ElementSetName>
    <csw:Constraint version="2.0.2">
      <ogc:Filter>
        <ogc:And>
          <ogc:PropertyIsEqualTo>
            <ogc:PropertyName>mc:productStatus</ogc:PropertyName>
            <ogc:Literal>PUBLISHED</ogc:Literal>
          </ogc:PropertyIsEqualTo>
          <ogc:PropertyIsEqualTo>
            <ogc:PropertyName>mc:hasTerrain</ogc:PropertyName>
            <ogc:Literal>true</ogc:Literal>
          </ogc:PropertyIsEqualTo> 
        </ogc:And>
      </ogc:Filter>
    </csw:Constraint>
    <ogc:SortBy>
      <ogc:SortProperty>
        <ogc:PropertyName>${sortColumn}</ogc:PropertyName>
        <ogc:SortOrder>${sortOrder}</ogc:SortOrder>
      </ogc:SortProperty>
    </ogc:SortBy>
  </csw:Query>
</csw:GetRecords>`;

export interface CswRecord {
  coverageId: string;
  resolution: number;
  // bbox: BBox;
  imagingEndDate: string;
}

export interface CSWResponse {
  nextRecord: number;
  recordsMatched: number;
  recordsReturned: number;
  records: CswRecord[];
}

@injectable()
export class CswClient {
  private readonly cswUrl: string;
  public constructor(
    @inject(SERVICES.CONFIG) private readonly config: IConfig,
    @inject(SERVICES.LOGGER) private readonly logger: Logger,
    @inject(SERVICES.HTTP_CLIENT) private readonly httpClient: AxiosInstance
  ) {
    this.cswUrl = this.config.get('csw.url');
  }

  public async getRecords(
    bbox: BBox,
    sortOrder: 'DESC' | 'ASC',
    sortColumn: string,
    startPosition: number,
    maxRecords?: number
  ): Promise<CSWResponse> {
    const body = generateCswBody(bbox, sortOrder, sortColumn, startPosition, maxRecords);
    try {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      const res = await this.httpClient.post(this.cswUrl, body, { headers: { 'Content-Type': 'text/xml' } });
      /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */

      const traversalObj = getTraversalObj(res.data as string, options);
      const jsonObj = convertToJson(traversalObj, options);
      const result = jsonObj['csw:GetRecordsResponse']['csw:SearchResults'];
      const records =
        result['mc:MCDEMRecord'] === undefined
          ? []
          : // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            result['mc:MCDEMRecord'].map((record: any) => ({
              coverageId: record['mc:coverageID'],
              resolution: record['mc:resolutionMeter'],
              imagingEndDate: record['mc:imagingTimeEndUTC'],
              // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
              // bbox: owsBoundingBoxToBbox({
              //   lowerCorner: record['ows:BoundingBox']['ows:LowerCorner'],
              //   upperCorner: record['ows:BoundingBox']['ows:UpperCorner'],
              // }),
            }));
      return {
        nextRecord: result['attr']['nextRecord'],
        recordsMatched: result['attr']['numberOfRecordsMatched'],
        recordsReturned: result['attr']['numberOfRecordsReturned'],
        records,
      };
      /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
    } catch (err) {
      const error = err as AxiosError;
      this.logger.debug(error.toJSON());
      if (error.response) {
        this.logger.error('Request to csw failed', { headers: error.response.headers, status: error.response.status });
        throw new Error('Request to the catalog has failed');
      } else if (error.request !== undefined) {
        throw new UpstreamUnavailableError('Catalog did not respond');
      }
      throw err;
    }
  }
}