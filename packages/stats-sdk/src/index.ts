export * from './manifest.ts';
export * from './reader.ts';

/** Props every extension widget receives. */
export interface WidgetProps<Data = unknown, Settings = Record<string, unknown>> {
	readonly data: Data;
	readonly settings: Settings;
}
