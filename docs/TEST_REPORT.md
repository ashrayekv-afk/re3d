# Version 9.0.3 software verification — 16 October 2026

This release adds descriptive cone footprint tracking and a schematic eye around the corneal data. It does not validate a clinical cone boundary or exact eye reconstruction.

- All nine JavaScript suites passed. The regional/image/3D/cone suite contains 56 test groups, including unchanged scans, expansion with a fixed threshold, centroid translation in mm, incomplete coverage, flat maps, thinning direction, source-resolution labels, disconnected latest regions, OD/OS orientation, geometry invariance, missing thickness and reference-anatomy isolation.
- All 41 Python tests passed. Frozen model artifacts, scalar extraction, the image reader and existing assessment implementation remain unchanged. Interface/cache identifiers are updated.
- The tracker processed all 12 available map comparisons from the existing four private eye pairs. Eleven footprints were resolution-limited at the printed color-bin bounds; these are explicitly marked point estimates, not resolved borders. Partial-mask boundaries are flagged. This successful processing is not evidence that the estimated footprint is clinically accurate.
- Eight existing report reconstructions rendered in the reference-eye context with all five supported overlays. Geometry remained unchanged when switching overlays, and selected sample indices remained bound to source vertices. Front, side and cutaway paths completed. Reference anatomy has no patient measurement IDs.
- Production Canvas-renderer output was inspected locally. The delivered preview is generated entirely from explicitly fictional geometry and maps; no patient content is included.
- **Verification limit:** browser interaction/layout and live Streamlit deployment were not tested for this release because the supported browser QA capability was unavailable. Previous browser results below are historical.
- Distribution uses the same 99-file structure, standard unencrypted ZIP DEFLATE, CRC testing and clean-extraction manifest verification. Private reports, extracted grids and QA renders are excluded.

The tracker uses provisional display definitions and paired support, not repeatability-calibrated clinical thresholds. The reference-eye dimensions and placement are illustrative. Reference shape is labeled when elevation is unavailable; it never becomes measured patient geometry.

---

# Version 9.0.2 software verification — 16 October 2026

This release changes the corneal presentation and supported overlays. It does not establish a 1:1 anatomical replica or clinical accuracy.

- Nine JavaScript suites passed; the regional/image/3D suite now contains 47 groups. Added geometry tests cover physical-coordinate overlay sampling, missing overlays, different diameters, normal direction, preserved normal thickness, supported-triangle rim clipping, equal spatial units, cutaway support and wider native height apertures.
- All 41 Python tests passed. Model files, scalar extractor, map reader, case schema, assessments and observed-evidence implementation are unchanged from 9.0.1. The service change is the displayed interface version.
- The final renderer processed the eight previously extracted eye/visit reconstructions. Each supported the shaded surface plus thickness, anterior curvature, posterior curvature and anterior elevation. Overlay switching left the underlying front/back geometry unchanged. Surface pick indices remained associated with supported original samples. Front, side and cutaway renders completed.
- Exact production Canvas-renderer output was inspected using a local software canvas. A separate preview uses explicitly fictional geometry and contains no patient data. No new OCR/import test was needed because the reader and source-data contract are unchanged.
- **Verification limit:** browser interaction, layout and live Streamlit deployment were not tested in this release. The supported browser QA capability was unavailable. Earlier 9.0.1 browser results below are historical, not a claim that the revised UI passed those checks.
- Package validation: 99 files, standard unencrypted ZIP DEFLATE, CRC and clean-extraction manifest checks. No patient source reports, extracted grids or private rendered patient figures are distributed.

The image-based route still assumes the floating BFS position/tilt and infers the inner surface from thickness. The smooth display does not make those assumptions measured facts. Large missing areas remain absent; the display rim trims slightly inside the supported aperture and labels its diameter. Native surfaces use supplied coordinates up to a 12-mm aperture, subject to their own sampling limits.

---

# Version 9.0.1 software verification — 16 October 2026

Engineering results on the recovered exports; not clinical validation or a native-grid accuracy study.

- **Diameter failure:** reproduced with the fallback/primary OCR path. Small 9-mm tags were returned as 3 mm or only mm. Expanded crops and cross-checks against observed numeral shapes and units resolve the tested failures. The primary-only path was explicitly tested on both left-eye visits; no default diameter or BFS fitting diameter was substituted.
- **Real maps and 3D:** 16 original pages from four eyes at two visits (two patients) supplied 24 regional map layers and eight elevation/thickness reconstructions. The final sampler was applied to those original source pixels with their individually read legends. All eight 3D models rendered, with approximately 94–96% modeled central coverage after local smoothing. This is not a direct-read or accuracy percentage.
- **Paired coverage comparison:** for the available bilateral earlier/latest pair, version 9.0 sampled 54/62/65% (OD anterior/posterior/thickness) and 58/62/68% (OS). Version 9.0.1 sampled 72/79/88% and 76/78/89%, respectively. New coverage comes from balanced nearby visible colors, with direct and locally recovered coverage recorded separately. Final filtering also excludes isolated colored-marker contamination.
- **Complete import path:** the production browser extractor processed both original bilateral ZIPs in longitudinal mode. Four selected eye/visit sets each retained six numeric measurements, all three regional map layers and a shape estimate with a confirmed 9-mm plot. No extraction or JavaScript error was reported (220 OCR jobs). Dependency requests were served from local matching test libraries; hospital-network CDN availability was not tested. The final colored-marker guard was subsequently checked on the original pixels and the browser component.
- **Regression:** nine JavaScript suites passed; the regional/image/3D suite has 41 check groups. New cases cover narrow ink recovery, large gaps, one-sided support, inconsistent colors, direct/recovered accounting, diameter units, and rejection of isolated colored alignment ink. All 41 Python tests passed.
- **Browser UI:** the three-map layout, new coverage breakdown, OD/OS, earlier/latest, 3D profile, cutaway, mobile width, one-visit reconstruction, clearing and stale-input blocking passed without JavaScript errors. Desktop output was visually inspected.
- **Preserved model:** model artifacts, scalar extraction engine, assessment and observed evidence are unchanged from 9.0. Interface version/cache keys were updated.
- **Package:** 99 files, standard unencrypted DEFLATE ZIP, CRC and clean-extraction manifest verification passed. No source patient reports, extracted patient grids or private QA images are distributed.

The 3D view remains an approximate corneal segment with an assumed centered/untilted reference sphere and a thickness-derived inner surface. Its geometry is not an exact replica or a measured posterior surface. Increased coverage does not remove image quantization, alignment or scan-repeatability limits. The complete ZIP's supported Belin page supplies the 3D route; simply displaying a Four Maps Refractive page is not a numerical surface import.

---

# Version 9.0 software verification — 15 October 2026

These are engineering checks on the available report exports. They do not establish clinical accuracy, an exact anatomical reconstruction, or progression prediction.

- **Actual report calibration:** browser Tesseract.js 7 fast and best English readers processed 16 original report pages from four eyes at two visits (two patients). All eight Topometric/KC-Staging pages supplied anterior and posterior curvature maps; all eight Belin–Ambrósio pages supplied thickness maps. All 24 map layers passed the reader's calibration/schema checks. These fixtures do not represent every Pentacam layout.
- **Patient 3D:** the same eight Belin pages yielded a signed anterior elevation grid and a corroborated printed BFS radius. The elevation/thickness reconstruction produced a triangulated surface at all eight eye/visit combinations, with approximately 78–92% modeled central coverage after local smoothing. This includes supported interpolation across small text gaps. No native height ground truth was available; successful rendering is not an accuracy estimate.
- **Mathematical checks:** 36 regional/image/3D test groups passed, including spherical sag, normal-offset thickness, missing-data preservation, immutable inputs, mismatched geometry, insufficient coverage, measured-grid orientation, laterality, and rejection of synthetic geometry on the patient route. The 21 map-identification/source-boundary checks passed.
- **Regression:** all nine JavaScript suites and 41 Python tests passed. An obsolete progression-summary test stub that referenced a previously removed component was updated to the existing regional component.
- **Browser component:** Chromium rendered the three real extracted map layers and the fixed baseline-region result. Profile rotation, cutaway, earlier/latest selection, OD/OS selection, a 390-pixel mobile viewport, source clearing, stale-input blocking and one-visit reconstruction passed with no JavaScript errors. Desktop and mobile output were inspected. This test used actual extracted grids in the component; it was not a complete new-version ZIP-import or live-deployment test.
- **Preserved calculator:** frozen model files, scalar extractor core, case schema, assessment and observed-evidence modules remain byte-identical to version 8.9. The service and Streamlit changes are interface version/key changes. Spatial OCR now serializes access to the existing secondary reader and passes the new shape data through the report boundary.
- **Distribution:** 99 files in a standard unencrypted DEFLATE ZIP, without a ZIP64 requirement. CRC testing, clean extraction and per-file SHA-256 verification passed. Patient reports, extracted patient map grids, debug crops and private QA screenshots are excluded.

The image route assumes a centered, untilted floating reference sphere because its position/tilt are unavailable in these reports. The inner surface is inferred from pachymetry along the anterior normal; it is not the independently measured posterior surface. Original scans and legends remain the source. Native measured anterior/posterior height grids use a separate route.

---

# Version 8.9 software verification — 12 October 2026

These are engineering checks on available fixtures, not validation of clinical progression, registration or measurement accuracy.

- **Regional/image calculations:** 32 check groups passed. Added tests cover equivalent mm/D visits, posterior signed-power magnitudes, nonlinear interval conversion, cross-layer diameter mismatch, physical hotspot position, identical/uniform/opposite changes, missing peak samples, immutable inputs, plus-sign recognition and displaced swatch/label calibration.
- **Map identification and source boundary:** 21 checks passed, including real import-wrapper worker forwarding, source association and rejection of malformed image maps. The obsolete report-gallery test now targets the current regional component.
- **Actual images:** the browser pixel pipeline plus the packaged Tesseract.js 7 English model read all three target maps for four selected earlier/latest eye pairs (two OD, two OS), including mm/D changes across visits and different report margins. These 24 maps were engineering fixtures. Tightened pixel masking was then applied using their read legends; no native-grid ground truth was available.
- **Complete ZIP import:** production ZIP discovery, six-field scalar extraction, report attachment and regional image reading processed two full bilateral report ZIPs using local WebAssembly OCR and Node Canvas. Both archives produced OD and OS, six scalar values per eye and all three target map types, without map-reading issues. Both visit pairs retained all three maps. Paired readable coverage was approximately 54/62/65% (OD) and 58/62/68% (OS), for anterior/posterior/thickness. This test used 565 local OCR reads; it is not a clinic throughput benchmark or a test of the CDN on a hospital network.
- **Browser UI:** Chromium displayed three maps from the actual extracted grids. OD/OS source switching and nasal/temporal label orientation, shared-view selection, location inspection, PNG export, stale-source blocking after edits, dirty-state clearing and next-patient clearing passed. Four viewport widths (1240, 760, 390, 320 px) had no page overflow. Desktop and mobile output were inspected. Zero JavaScript errors in this test.
- **Live app:** Streamlit 1.50 launched and calculated the synthetic bilateral example through the Python service. The updated regional dropdown and component assets loaded successfully.
- **Preserved model:** 16 baseline/longitudinal cases across eyes, ages, scan intervals and quality flags matched 8.8 exactly apart from the interface version. Frozen model files, scalar extractor, case schema, assessment and observed-evidence code remain byte-identical.
- **Bilateral regression:** existing discovery tests passed for current/legacy/mixed formats, eye association, partial inputs, folder boundaries, missing titles, cancellation and retained edits.
- **Distribution:** 99 short relative file paths in a standard unencrypted DEFLATE ZIP, with no ZIP64 requirement. CRC testing, extraction and per-file SHA-256 verification passed. Patient reports, patient data rows, extracted patient map grids, QA screenshots and debug crops are excluded.

The automated reader is limited to the supported original report layouts. Coarse legends, text, scan variability and display alignment limit the maps. A relative hotspot does not establish progression, and blank/missing regions do not establish stability. The 0.8-mm window, masking and display scales are engineering settings, not validated biological thresholds.

---

# Version 8.8 software verification

These checks establish implementation behavior on the available fixtures, not clinical accuracy or diagnostic validity.

- **Actual report workflow:** the real ZIP discovery and `attachAssociatedReportPages` import wrapper processed the available January and March report archives in Chromium, using the existing Tesseract worker through a local test bridge. Each archive produced two associated studies and all three target image maps per study (front curvature, back curvature, thickness). All twelve grids passed interval/schema checks. Both paired studies had three comparable maps; common readable coverage was approximately 54% and 49%. Identical-image comparisons produced zero highlighted shifts.
- **Additional formats:** the local reader successfully read an available 1200 × 838 export with a front diopter scale, back radius scale and thickness scale; a 1200 × 910 legacy thickness report with a different printed thickness legend also parsed. These are engineering fixtures, not a representative clinic accuracy benchmark. Arbitrary layouts are not covered.
- **Regional tests:** 22 numerical/image test groups passed, including original area calculations, monotonic scale requirements, missing/obscured color handling, identical scans, overlapping color intervals, radius/thickness direction, signed posterior D, matching units/diameters, insufficient coverage, invalid intervals, and different numeric calibrations for the same color.
- **Preserved calculator:** 16 baseline/longitudinal cases across eyes, ages, intervals and quality flags produced exactly the same numeric outputs as 8.7 apart from the interface version. Frozen model files, scalar extractor engine and observed-evidence code are byte-identical. The new report attachment wrapper adds only the separate image estimates.
- **Browser integration:** actual extracted image grids traversed the nested importer message boundary and displayed through Current case after calculation. Layer switching, location inspection, original-source binding, invalidation after edits, and next-patient clearing passed. Simulated numerical maps remained excluded from the automatic patient route. Zero JavaScript errors.
- **Layout:** 1200, 760, 390 and 320-pixel widths passed page overflow checks. The inspection table scrolls horizontally on narrow screens, preserving readable labels.
- **Bilateral discovery:** existing tests passed for current/legacy/mixed reports, partial inputs, eye association, folder boundaries, cancellation and retained edits.
- **Actual Streamlit 1.50:** launch, Python calculation, regional dropdown and 8.8 footer passed without an app exception.
- **Distribution:** standard unencrypted DEFLATE ZIP, no ZIP64 requirement, 99 short relative file paths. CRC testing, clean extraction and per-file SHA-256 verification passed. No patient report images, patient rows, debug crops or QA results are distributed.

The image reader uses printed plot geometry, not anatomical registration. Its percentages and color-derived values have not been validated against device grids or adjudicated progression. This is an experimental visual supplement; it does not change NKPI or resolve scan-quality uncertainty.

---

# Version 8.7 software verification

These checks verify software behavior. They do not establish clinical accuracy, repeatability or progression detection.

- Thirteen numerical test groups passed: physical/nonuniform cell areas, directional posterior curvature, thinning, unchanged scans, null masking, one-layer and no-common-data behavior, mismatched eyes/visits/units/grids/registration definitions, sign conventions, invalid inputs, synthetic/real separation, nearby/apart patterns, immutable inputs and explicit audit labeling.
- Sixteen deterministic synthetic baseline/longitudinal cases spanning both eyes, quality flags and scan intervals produced exactly the same numerical outputs as 8.6, apart from the interface version. Model artifacts, extractor files, schema and observed-evidence calculations are byte-identical.
- The existing bilateral discovery test passed (legacy/current/mixed formats, missing/partial inputs, separate-eye associations, cancellation and edits).
- Chromium exercised the real calculator component with the Python calculation service: scores, observed evidence, report messaging, synthetic-map exclusion from the patient path, numerical binding, invalidation after edits, and next-patient clearing. Zero JavaScript errors.
- The separate numerical-pair route was tested with the synthetic JSON, malformed replacement, map switching, map-cell inspection and adjustable cutoffs. Invalid replacement clears the prior result.
- Offline demo widths 1200, 760, 390 and 320 pixels passed horizontal overflow checks. Desktop/mobile screenshots were visually reviewed.
- Actual Streamlit 1.50 launch passed. The bilateral example calculated through the live server, the new regional dropdown rendered, and the footer showed 8.7.0-regional-change. No app exception appeared. Top spacing was corrected so Streamlit’s toolbar does not cover action buttons.
- The 99-file ZIP uses standard DEFLATE compression with short relative paths, no encryption, and no ZIP64 requirement. CRC testing, extraction and per-file hash comparison passed. No patient records or source report images are included.

Tests used synthetic numerical maps and mock report pixels. Anatomical registration and clinical performance were not tested on measured patient grids. Report-only JPEG exports cannot validate this engine. The old full-workflow OCR was preserved, not newly benchmarked on an entire clinic cohort.
