# Patient corneal shape — version 9.0.3

## Surface sources and reference context

**Report-image estimate:** the standard anterior elevation map and printed floating BFS radius from the selected Belin–Ambrósio page, together with that page's thickness map. Front shape is a centered, untilted sphere plus signed elevation, converted from µm to mm. The printed floating BFS translation and tilt are unavailable; this reconstruction explicitly assumes their values. Enhanced/exclusion and difference maps are not substituted. Curvature colors and NKPI scalars never generate height.

A local weighted plane (0.6-mm radius) smooths the elevation and thickness. At least six valid neighboring samples and 50% local readable support are required, with a maximum nearest-sample distance of two sample steps (or 0.25 mm for very fine grids). Large missing areas remain open. A model requires at least 50% coverage of the sampled central region. The inner surface is an offset along the reconstructed anterior normal by image-derived pachymetry. This is a modeling approximation, not recovery of independently measured posterior geometry. The displayed range is the modeled thickness range, not the device's minimum thickness.

**Native height reconstruction:** matching `kind: measured` / `source: device_numeric_export` anterior and optional posterior `z_mm` grids pass the existing strict `CornealData` schema. Declared physical axes, laterality and z direction are respected. A supplied device thickness map colors the mesh; the renderer does not infer thickness from raw vertical front/back separation. Missing cells and reversed front/back ordering are omitted. Synthetic fixtures cannot enter the patient route.

## Association and display

The selected eye, visit and input snapshot must match the imported source binding. Input changes, source changes, removal of an eye and next-patient reset sever the link. The view never silently uses the other eye or a simulated cone. A labeled standard reference surface can be shown when patient elevation is unavailable. Earlier/latest shapes are independent views, not a registered height subtraction. OD and OS keep the native report orientation (OD temporal at screen left, OS temporal at screen right in front view).

All physical axes use the same scale. There is no vertical exaggeration. The native or estimated source label is embedded in exported PNGs. The component uses local Canvas rendering and the existing local OCR models; there is no new API or remote AI reader. No report images, calibration grids or geometry are sent to the score server.

## Native export contract

The existing `nkpi-corneal-surface-1` schema requires:
- eye and visit (`OD`/`OS`, `first`/`latest`), measured source and units;
- finite, increasing x/y axes in mm and explicit orientation;
- anterior `z_mm`, optional posterior `z_mm`, optional device `thickness_um`;
- null for missing samples; enough complete cells for rendering.

Use the existing `nkpi-surface-index.json` association workflow in `docs/AUTO_DICOM_IMPORT.md` and numerical conversion documentation. Image-derived estimates have their own internal `nkpi-image-shape-1` contract and are never labeled as device exports.

## Basis and limitations

Reference-sphere radius and placement affect interpretation of elevation maps: https://pmc.ncbi.nlm.nih.gov/articles/PMC4142625/ . The report does not supply all of that pose information. Therefore this supplement is an approximate visualization, not an exact anatomical replica, a validated diagnostic surface, a surgical planning model, or evidence that a region will progress. The calculator's scalar inputs and NKPI are unchanged.

## Diameter confirmation and sample coverage

Version 9.0.1 uses expanded tag crops, cross-crop OCR, numeral-shape recognition and an isolated-digit retry. A valid printed plot size and unit are required. A BFS fitting diameter is never used as the plot diameter. The shape view uses the updated image sampler, including explicitly tracked local-color recovery and rejection of isolated colored-marker artifacts. Modeled coverage includes the further local smoothing/interpolation described above; it is not a direct-data or accuracy percentage.


## Shaded shell renderer (9.0.2)

A local software depth buffer renders front, back and boundary faces with per-vertex lighting. Lighting changes appearance only. The selected image reconstruction still uses the same BFS/elevation geometry and normal-offset thickness model. The default is an oblique shaded corneal shell; a true-scale center section shows both boundaries. Rotation, keyboard rotation, zoom, cutaway, point inspection and PNG export are local. No new external library or service is required.

The display rim is clipped to a 96-sided circle slightly inside the sampled aperture (1.2 grid steps, capped at 8% of the radius). New edge vertices are interpolated only within existing supported triangles. This reduces the staircase appearance without extending data coverage. The displayed diameter is labeled. Larger interior gaps stay open and no iris, sclera or globe is invented. Regional measurements are unaffected.

For image data, anterior/posterior curvature overlays are sampled in the same report x/y frame, with physical diameter conversion and missing values preserved. Radius-to-power conversion matches the existing regional analysis; posterior power is shown as a magnitude. Curvature never generates the mesh. The posterior curvature overlay uses the outer shell for location comparison, not independently recovered posterior geometry. Optional native posterior elevation is displayed only when supplied. The color range describes the available mesh samples, not the whole cornea or scalar extrema.

Summary ARC, PRC, thinnest thickness, Kmax, BAD-D and ARTmax are taken from the bound calculator result and selected visit. They do not distort the surface or create spatial maps. Native heights now use the supported supplied aperture up to a 6-mm radius rather than always cropping to a 3-mm radius. The display still inherits all measurement and sampling limitations; it cannot be called an exact 1:1 replica.

## Reference eye and fallback (9.0.3)

A procedural reference globe (12-mm radius), iris and peripheral reference cornea (7.8-mm sphere radius) surround the central data patch. These are illustrative design dimensions, not fitted patient anatomy or clinical normality cutoffs. Their positions relative to the data patch are assumed. They are rendered independently and never enter spatial analysis or NKPI. Reference geometry has no patient sample-selection IDs.

The central patch retains native heights when available, otherwise the existing report-elevation reconstruction. If that cannot be formed, `kind: reference` provides a standard spherical front surface with available overlays. Available thickness can offset an inner boundary; missing thickness remains missing. Curvature is never converted into arbitrary bump height. This fallback is labeled in the view and saved figure; a reason is retained in the method drawer. It is an illustrative map-bearing cornea, not a patient-specific shape estimate.

**Cornea + eye** provides anatomical context. **Cornea close-up** uses the existing equal-scale central view. Overlay selection does not change geometry. Curvature magnitude, thickness, elevation and confirmed summary values retain distinct meanings. Earlier/latest reconstructions are not animated as a registered deformation.
