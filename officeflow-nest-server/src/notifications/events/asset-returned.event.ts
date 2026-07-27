export class AssetReturnedEvent {
  constructor(
    public readonly assetId: number,
    public readonly assetTag: string,
    public readonly assetName: string,
    public readonly previousAssignedToId: number,
    public readonly returnedByName: string,
  ) {}
}
