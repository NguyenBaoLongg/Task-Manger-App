export interface XlsxSheetInput {
  name: string;
  columns: string[];
  rows: unknown[][];
}
export interface StreamingXlsxSheetInput {
  name: string;
  columns: string[];
  rows: AsyncIterable<unknown[]>;
}
export declare function writeXlsxWorkbook(input: { sheets: XlsxSheetInput[] }): Promise<Buffer>;
export declare function writeXlsxWorkbookToFile(
  input: {
    sheets: StreamingXlsxSheetInput[];
  },
  filePath: string,
): Promise<{
  byteSize: number;
  checksumSha256: string;
}>;
//# sourceMappingURL=xlsx-writer.d.ts.map
