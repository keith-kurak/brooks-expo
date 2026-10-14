/**
 * What the app sends the shoe mileage widget. Every value is finished: the
 * widget's runtime can import nothing, so it formats nothing.
 * @ref LLP 0006#the-widget-reads-the-app-group
 */
export interface ShoeMileageWidgetProps {
  /** False before the runner adds a pair. */
  hasShoe: boolean;
  name: string;
  /** 0 to 1, for the gauge. */
  share: number;
  /** "70%" */
  percent: string;
  /** "Time to replace" or "52 mi left" */
  status: string;
  /** "280 of 400 mi" */
  miles: string;
  /** "About 3 weeks at your pace", or empty. */
  pace: string;
  replace: boolean;
  /** Opens Your shoes in Profile's stack. */
  url: string;
  /** "248": the miles alone, for the readout. */
  milesShort: string;
  /** "300 mi" */
  limit: string;
  /** The shoe photo, a file URL in the App Group, or empty. */
  image: string;
}
