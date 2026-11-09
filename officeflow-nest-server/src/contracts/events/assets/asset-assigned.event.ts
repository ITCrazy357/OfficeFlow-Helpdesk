export class AssetAssignedEvent {
  constructor(
    public readonly assetId: number,
    public readonly assetTag: string,
    public readonly assetName: string,
    public readonly assignedToId: number,
    public readonly assignedByName: string,
  ) {}
}
