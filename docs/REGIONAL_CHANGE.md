# Regional corneal change — 9.0.1

This supplement describes the **location, extent and relationship of observed map changes**. It does not classify progression, predict a future NKPI, estimate corneal strength, or change NKPI. No spatial model was trained on the 426-eye inventory.

## Current case, demo and separate import

**Current case** displays original report pages explicitly associated by the existing extractor with the selected eye and visit. They are browser-local blob URLs. The original report's legends and printed values remain authoritative. Supported report images now supply a separate color-derived regional comparison as described below. Original source reports remain available.

When the existing same-ZIP numerical mechanism supplies matching measured map files, the engine can analyze them. Both selected visits, verified scalar calculation, matching eye and visit roles, and a matching imported input snapshot are required. Edited inputs or changed source associations invalidate that numerical binding; reimport to restore it. Anatomical registration remains the responsibility of the numerical export/conversion workflow.

**Explore demo** generates synthetic maps in the browser. It does not read patient measurements. OD has small simulated changes; OS has larger simulated changes. Nearby and separated modes retain the same analytical peak amplitudes while moving their centers. Sampling and the aperture can slightly change numerical area. Synthetic maps cannot enter the automatic patient path.

**Numerical pair** accepts a separate research JSON. It is explicitly not linked to the calculator case. The file's eye controls its display. Loading it does not set NKPI inputs, claim patient identity, establish scan quality, or prove registration. Invalid replacements clear the previous imported pair.

## Automatic report-image comparison

This is a separate path from the device-numerical engine documented below. It runs locally in the browser during the existing ZIP import; the same selected-study association, calculation snapshot and eye/visit boundaries apply. Edited measurements invalidate the source binding. Reprocessing restores it.

1. Identify associated Topometric/KC-Staging front/back axial maps and Belin thickness. Confirm titles, plotting diameter and units from the printed report. Locate the plotting frame using the supported original export layout. Do not align disease patterns or fit a circle to the colored region.
2. Locate each adjacent color legend. Match individual printed numeral shapes using deidentified glyph templates, and corroborate the numerical magnitudes of at least five anchors with Tesseract OCR. Signs are read from the isolated glyphs. A tightly cropped line retry is used when whole-column OCR drops signs or decimal points. At least twelve monotonic glyph anchors are required on that route. A fallback requires at least eight anchors agreed by two OCR renderings, broad legend coverage and no large unreadable gap. This is computational consistency, not two independent source measurements. Values are never inferred from palette colors without readable numeric labels.
3. Calibrate the map against its own legend, not the other visit's palette. Match the color of each labeled broad swatch to the adjacent fine strip within its local vertical neighborhood before assigning values; printed label centers are not assumed to be the fine-strip anchor positions. Exclude colors poorly matched to that legend. Bound the estimate using nearby palette matches and half of the adjacent printed-label spacing. These intervals are engineering bounds on color resolution, not statistical confidence or repeatability intervals.
4. Use 41 × 41 sample positions within the central two-thirds of the printed plot radius. Direct pixel patches require at least 85% readable pixels and at least 85% of those estimates within one local printed step of their median. An isolated jump from the surrounding ring (at least eight readable ring pixels) is omitted to reduce colored-marker artifacts. When the initial patch is obscured, recovery can use visible pixels within 3% of the plot radius: at least eight pixels, 35% valid support, support in at least three quadrants, a support centroid within 35% of that window radius, and 85% value coherence. The retained color intervals use outer bounds. Locally recovered samples are counted separately; large or one-sided gaps remain unavailable.
5. Match map type and printed diameter across visits. Convert anterior radius to 337.5/r and posterior radius to magnitude 40/r (r in mm), including reversed nonlinear interval endpoints. Posterior D comparisons use magnitudes; thickness remains in µm. A radius interval reaching zero is unavailable. Mixed mm/D visits are permitted only after conversion. Require at least 35% readable paired coverage per map. Plot-frame alignment does not correct eye motion, decentration, rotation or anatomical misregistration.
6. The three-map overview shows point-estimated positive curvature-magnitude change or thinning; zero/opposite change is gray and missing samples are hatched. Color limits are computed separately for each map (95th percentile of nonnegative sampled changes, with a floor at one quarter of the positive maximum). Values above the limit saturate; the legend marks the upper bound with ≥. This is a visualization choice, not a threshold for progression. No age, forecast, NKPI value or scan-interval multiplier changes the map.
7. Locate a local concentration using a circular window of radius 0.4 mm, fully inside the aperture, with at least five readable samples and 85% readable coverage. Select the largest positive mean estimated change. Near-equal maxima are represented by the eligible point nearest their mean location. If there is no eligible positive maximum, or local candidate means vary by less than 1% of the maximum (with a small numerical tolerance), no distinct hotspot is marked. Missing regions cannot establish where the overall corneal maximum lies. The mean color-bin bounds are shown only as a resolution check, not as statistical uncertainty.
8. The collapsed shared-change view retains the stricter rule: positive shifts require non-overlapping color-derived intervals. Individual peaks and this resolution-based overlap answer different descriptive questions.
9. Per-map percentage is highlighted samples divided by readable paired samples. Shared percentage uses samples readable in every available layer and shifted in at least two. It needs at least two maps, identical physical apertures across layers, and 35% common coverage. Different diameters disable overlap while retaining the separate maps. Percentages are descriptive fractions of the sampled image region, not exact tissue areas. No neighboring grid value is copied into a hole. Small obstructed sample locations can be estimated from surrounding visible source pixels and are explicitly labeled locally recovered. This does not establish clinical accuracy.

The method can miss changes smaller than a report's color step and can highlight alignment/rendering artifacts. Sparse/no highlighted areas do not prove stability. It has not been validated for clinical progression decisions. The supplied reports served as engineering fixtures, not as an independent clinical validation set. This addition does not independently verify source identity, eye association, scan quality, or treatment status.

### Inputs, units and figure export

Topometric/KC-Staging supplies anterior and posterior axial curvature; Belin–Ambrósio supplies thickness. Four Maps Refractive posterior elevation is not posterior curvature. No conversion from elevation to curvature is attempted. Reports must be original exports in the supported layout, without rotation or mirroring.

Coordinates retain standard report orientation: superior at the top; OD temporal left/nasal right, OS nasal left/temporal right. There is no cone recentering. The reported aperture is twice the physical sampling radius (6 mm when the printed diameter is 9 mm).

**Save map figure** exports the selected eye's current three-map estimate, interval, units, coverage and descriptive caveat. It does not include original report pixels or identifiers. **Download audit** records the available layers, source units/page IDs, missing-layer reasons, geometry eligibility, summary changes, peak coordinates/window coverage/bounds and the method description. It is not a substitute for retaining the source scan provenance in the study record.

The radius-to-power conventions are documented in the [OCULUS interpretation guide](https://www.pentacam.com/fileadmin/user_upload/pentacam.de/downloads/interpretations-leitfaden/Pentacam_Interpretation_Guide_Ophth_EN_0624.pdf) (anterior axial keratometric power 337.5/r) and [an original Pentacam measurement study](https://pmc.ncbi.nlm.nih.gov/articles/PMC7387898/) (posterior surface refractive-index difference 1.336 − 1.376, hence magnitude 40/r with r in mm). These conventions do not validate the image digitization or the hotspot algorithm.

No private reports are bundled. The numeral templates contain only isolated digit shapes. Native measured maps, when available and compatible, take priority and remain explicitly distinct from image estimates.

## Supported numerical pair

The example `SYNTHETIC_REGIONAL_PAIR.json` is executable and explicitly synthetic. It must not be relabeled as patient data. The top-level shape is:

```json
{
  "schema": "nkpi-regional-pair-1",
  "interval_days": 180,
  "first": {"...": "documented first-visit map object"},
  "latest": {"...": "documented latest-visit map object"}
}
```

Each map object follows the existing `nkpi-corneal-maps-1` contract in `SURFACE_DATA.md` and `components/cornea/surface_schema.js`. For actual measured data:

- `kind`: `measured`; `source`: `device_numeric_export`.
- `eye`: `OD` or `OS`; `visit`: `first` or `latest`.
- Units: `{ "xy":"mm", "z":"mm", "elevation":"um", "thickness":"um", "curvature":"D" }`.
- `coordinate_system`: origin `corneal_vertex`; explicit x/y/z positive directions.
- `x_mm`, `y_mm`: strictly increasing arrays of 3–201 coordinates. Grids are rows of y, columns of x. Both visits must have exactly the same axes and coordinate conventions.
- `anterior.curvature_D` and/or `posterior.curvature_D`: numerical arrays with `curvature_type` set to matching `axial`, `tangential` or `mean` definitions. `device_reported` without a specified definition is not accepted for comparison.
- `thickness_um`: numerical array with `thickness_definition`: `device_pachymetry`.
- Missing samples: JSON `null`. They are not imputed.
- Both objects must contain the same `comparison` object: `alignment` = `verified_common_grid`, and nonidentifying `registration_id` and `map_definition_id` keys. These declarations attest work done upstream; this app cannot verify their truth.

At least one matching analyzable layer is required. Posterior curvature must use a single nonzero sign convention across both scans. Anterior curvature must be positive. Mixed measured/synthetic sources, mismatched units, grids, definitions, eye or visit roles are rejected. Unknown fields are rejected; names, MRNs, dates and arbitrary free-text identifiers are unnecessary.

Elevation arrays are not analyzed by this version. Independently fitted elevation references can create misleading differences; converting elevation into a compatible curvature map is outside this module. A scalar ARC/PRC or Kmax must not be copied across a map grid.

## Automatic same-ZIP association

The existing extractor accepts a root `nkpi-surface-index.json` with schema `nkpi-surface-index-1` and entries linking an actual report archive path to its map JSON:

```json
{
  "schema":"nkpi-surface-index-1",
  "entries":[
    {"report":"example-report.jpg", "surface":"example-maps.json"}
  ]
}
```

The report path must correspond to the selected study and the map must match its eye/visit. One unambiguous numerical file per study is required. The regional UI uses the existing importer association and additionally binds that pair to the imported scalar snapshot. A correct path or checksum does not itself prove patient identity or anatomical registration. Native proprietary device files are not automatically converted. A verified converter must first create the documented objects from actual device numerical exports.

## Computation

1. Use full rectangular cells with all four corners inside the central 6-mm aperture. Keep cells on the original supplied grid; no interpolation, image registration or resampling is performed.
2. For each layer and visit, average the four corners of a cell. If any corner is missing at either visit, that layer's cell is unavailable.
3. Directional change is `latest − first` for positive anterior curvature, `abs(latest) − abs(first)` for consistently signed posterior curvature, and `first − latest` for thickness. Positive values represent the specified direction of change; they are not diagnoses.
4. Highlight changes **at or above** the selected display cutoff. Defaults are 1 D anterior, 0.25 D posterior and 10 µm thinning. These are illustrative engineering settings and have no claimed repeatability calibration or clinical validity.
5. Cell area is `(x[i+1] − x[i]) × (y[j+1] − y[j])`. Report planar projected mm², not true curved surface area.
6. Report total highlighted area, area-weighted mean directional change within it, and the area/area-weighted center of the largest edge-connected patch. Four-neighbor connectivity is used. Small regions are not automatically removed or called artifacts.
7. Shared area is the sum of cells crossing cutoffs in at least two available layers, restricted to cells having data in **every** available layer. With one layer or no common cells, shared area is unavailable, not zero. Layers without comparable cells likewise have unavailable regional area. This is a descriptive intersection, not independent corroboration or a calibrated score.

The side labels reflect the displayed eye and declared axis directions. Cell inspection reports four-corner means, not a measured value exactly at the cell center. Actual scan interval is displayed; differences and cutoffs are not extrapolated to another interval.

## What remains unvalidated

The current engine does not include scan-noise estimation, severity-specific spatial repeatability, multiple-location significance testing, treatment effects, contact-lens effects, or persistence across three visits. Adjacent grid samples and layers are correlated. Overlap is not proof of progression, and a lack of overlap is not proof of stability. Anterior curvature, posterior curvature and thinning can be spatially offset.

Quality flags on the main score still apply. A successful numerical parse is not a quality certificate. Baseline-only scans cannot establish observed change. Report-image estimates do not supply device-level precision or anatomical registration.

The next research gate is a registered numerical-map cohort with repeat acquisitions and independently adjudicated longitudinal outcomes. Compare added regional features with NKPI plus Pentacam ABCD using patient-grouped evaluation. Demonstrate better detection or fewer false alarms before interpreting area/overlap clinically. Keep a repeatability-calibrated analysis distinct from these adjustable display cutoffs.

## Primary literature

- REDCAKE Study Group (2021). Regional versus single-point parameters: https://pubmed.ncbi.nlm.nih.gov/34050086/
- Long-Term Zonal Average Analysis of Corneal Tomography in Keratoconus Eyes: https://pubmed.ncbi.nlm.nih.gov/35389929/
- Steinwender et al. (2022). Differences between cone-localization methods: https://pubmed.ncbi.nlm.nih.gov/36203753/
- Zheng et al. (2017). Alignment and repeatability of elevation maps: https://pubmed.ncbi.nlm.nih.gov/29234085/
- Detection of Corneal Ectasia Using OCT Maps of Pachymetry and Posterior Surface Mean Curvature (2022): https://pubmed.ncbi.nlm.nih.gov/35946999/

These publications support investigating regional patterns. They do not validate this software's defaults, shared area, or clinical performance.


## Fixed baseline region and location checks (9.0)

The baseline marker is the 0.8-mm window with the greatest baseline curvature magnitude (or lowest baseline thickness), using readable paired samples. Its change is evaluated at those fixed coordinates. It is not necessarily the device's Kmax or thinnest point, and a missing/distinctness-limited marker stays unavailable.

A descriptive proximity sentence uses resolved hotspots only (mean lower color-bin bound > 0). Hotspots within 0.8 mm of one chosen hotspot are described as nearby; this is not proof of a common pathological process.

Four sensitivity scenarios shift the latest sampled map by one grid cell left/right/up/down. Two more use its lower/upper color-bin endpoints. The location tally counts a supported positive peak within 0.8 mm of the unperturbed peak. Six of six means only that these six processing scenarios retained a nearby peak. It is not a probability, validated reliability category, or scan-repeatability estimate.

Supported-layout legends use their complete printed rectangles. When fine-strip calibration cannot be matched consistently, the reader can use the labeled broad swatches with conservative bounds spanning adjacent readable labels. Missing labels are not assigned invented values. Grayscale/text pixels are not used as map values. The 9.0.1 sampler may recover a location from balanced nearby visible colors, with separate coverage accounting. The 3D renderer additionally applies its documented local weighted-plane approximation.


## Cone evolution tracker — 9.0.3

A descriptive paired-map supplement; it is not a validated cone segmentation or progression detector. No new clinical threshold is introduced.

1. Use only paired finite samples on a common grid. Image inputs inherit printed-circle alignment and central two-thirds radius; native inputs inherit validated paired axes and declared registration. Convert curvature to the existing positive-magnitude convention and orient thickness toward thinning.
2. Compute paired 0.8-mm-diameter local means using the identical neighbor mask at both visits, requiring 75% local support and at least five samples. Missing center samples are not filled. Whole-map paired support must be at least 60%. These are provisional display criteria.
3. Let baseline prominence be the maximum local mean minus the median local mean. Exclude nearly flat maps (prominence no greater than 0.2% of the absolute peak). Set the boundary at median plus half the prominence. Select the connected baseline component containing the strongest baseline region; minimum sampled area 0.2 mm². This identifies a relative steep/thin footprint, not disease-specific anatomy.
4. Apply exactly that level and mask to the later field. Select the latest connected component with greatest overlap with the baseline component. If none overlaps, no latest region is matched and center shift is unavailable; disconnected regions are reported separately. Smaller/excluded areas are not interpreted as cure or tissue disappearance.
5. Report area-weighted fixed-baseline-region change (raw paired values), the same change in a 0.6-mm outer band, their difference, sampled footprint area and area-centroid displacement. Positive change means steepening or thinning. Show 40% and 60% prominence boundary sensitivity in details. These are processing scenarios, not confidence intervals.
6. Flag footprints touching the supported-mask edge as partial. The displayed mask is eroded by the required local-window radius; unsupported regions are hatched. Image area is a sampled planar estimate, not measured corneal surface area. Resolution-limited images still show the point-estimate outline, explicitly marked; the boundary is not resolved by their printed bins. Color-bin resolution does not describe device repeatability. A center shift is distribution change, not proof of tissue migration.

The three existing maps and cross-map shared-change panel remain unchanged. A scalar-only baseline visit cannot supply observed cone evolution. No forecast, causal interpretation, control-cohort comparison or treatment recommendation is generated by this addition.
