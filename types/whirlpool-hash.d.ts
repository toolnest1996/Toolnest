declare module "whirlpool-hash" {
  export class Whirlpool {
    update(message: string): void;
    finalize(): string;
  }
}
