declare module "@pdfsmaller/pdf-encrypt" {
  export function encryptPDF(
    pdfBytes: Uint8Array,
    userPassword: string,
    options?: {
      ownerPassword?: string;
      allowPrinting?: boolean;
      allowCopying?: boolean;
      allowModifying?: boolean;
    },
  ): Promise<Uint8Array>;
}
