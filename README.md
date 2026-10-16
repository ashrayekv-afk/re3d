# NKPI bilateral calculator — 9.0.3

**Regional change & 3D corneal view** adds a patient-linked, collapsible cone tracker and corneal visualization to the existing calculator. NKPI coefficients, scoring, and existing eligibility logic are unchanged.

## Install / update

1. Download **NKPI_v903_Extract.zip**, then use Windows **Extract All**.
2. Upload the extracted contents to the existing GitHub repository, replacing matching files and preserving folders. Do not upload the ZIP itself.
3. Keep the Streamlit entry point **kcn_dual_calculator_app.py**. Reboot the app and refresh the browser.
4. Confirm **9.0.3-cone-evolution** in the footer.
5. **Re-upload and process the original Pentacam ZIPs after updating.** This reconnects both visits to the updated components.
6. Calculate as usual. Open **Regional change & 3D corneal view → Current case → OD/OS**, then **Cone evolution tracker** or **3D corneal view**.

The package contains 99 files. No new API key, upload step, or cloud AI service is required. The existing local second OCR model now also helps read spatial legends. Image processing stays in the browser. Local launch: `pip install -r requirements.txt`, then `streamlit run kcn_dual_calculator_app.py`.

## New in 9.0.3

- **Cone evolution tracker:** a collapsible panel beneath the regional maps overlays earlier and latest footprints. Select anterior curvature, posterior curvature or thickness. It reports sampled footprint area, change inside the earlier region relative to a surrounding band, and center shift. The boundary definition and paired readable mask are fixed across visits. Definition and sensitivity checks are in the drawer.
- **Reference eye with corneal data:** a standard globe, iris and peripheral cornea provide context. Use **Cornea + eye** or **Cornea close-up**, rotation, zoom, cutaway and available overlays.
- When elevation supports reconstruction, the central surface uses that data and the existing BFS assumption. Without it, a labeled standard 7.8-mm-radius corneal shape still displays available curvature/thickness maps. Curvature colors do not invent cone height. Available thickness sets the inner offset; absent thickness is not imputed.
- The eye surrounding the central patch is schematic and does not contribute to any measurement. It is not a 1:1 replica. Source type is embedded in saved figures.
- Existing regional maps, extraction, NKPI scoring and selected-source binding are retained. No additional upload or API key is needed.

## Reader fixes retained from 9.0.1

- The elevation map can be present even when its tiny plot-diameter tag is unreadable to OCR. The reader now expands the crop and cross-checks the printed numeral shape and unit. It never substitutes the BFS fitting diameter or a hard-coded plot size.
- Regional maps retain the same three-card layout. Coverage is now labeled **sampled**, with **direct** and **locally recovered** portions shown separately. Nearby visible source colors can recover narrow printed obstructions; large gaps stay unavailable.
- An isolated value inconsistent with surrounding source colors is excluded to reduce false peaks from colored alignment marks. The same sampling improvement supplies the 3D elevation/thickness reader.
- This fixes the supported Belin report route within the complete ZIPs. The presence of a Four Maps Refractive page in the source viewer does not by itself calibrate 3D geometry.

## Features

- **3D at one visit:** rotate, zoom, select Front/Side, inspect a cutaway, switch supported overlays, select a nearby sample and save a figure. A second visit is not required for shape.
- **Earlier / latest:** switch actual selected reports. Visits are independently reconstructed, not presented as an anatomically registered 3D difference or a forecast.
- **Fixed baseline region:** a dashed teal circle locates the baseline steepest/thinnest supported region; its change is measured at the same map coordinates.
- **Spatial agreement:** one sentence summarizes whether resolved change hotspots are nearby across maps.
- **Location sensitivity:** six processing scenarios check whether the hotspot stays nearby. This is not a clinical confidence score.
- Existing three patient change maps, shared-change view, numeric export pathway, and original source reports remain available.

## What the report images can support

The 3D image route reads the **standard anterior elevation map, printed anterior BFS radius, and pachymetry map from a supported Belin–Ambrósio report**. It uses the uploaded patient’s values, with a centered, untilted floating reference sphere assumption. The anterior surface is smoothed locally; the inner surface is inferred using thickness along the anterior normal. This is an **approximate corneal segment**, not an exact full-eye replica or a measured posterior surface. Open patches indicate missing image information, not missing tissue. The thickness range describes the modeled region, not the scalar thinnest-pachymetry result.

True native anterior/posterior height grids, when supplied through the existing documented numerical association, are rendered directly and labeled separately. Image-derived geometry never becomes native data and never affects NKPI.

Supported automatic layouts are original 1200-pixel-wide exported reports (including proportional scaling), with their complete legends and titles. Arbitrary phone photos, rotated/mirrored images, incomplete pages, and undocumented layouts are not supported automatically. The tested ZIPs contain the required Belin pages. Keep the complete report ZIPs.

The regional comparison still needs earlier and later **Topometric/KC-Staging** anterior/posterior axial curvature maps and **Belin–Ambrósio** thickness maps. Four Maps Refractive contains posterior elevation, not posterior curvature; it is not substituted for that measurement.

See `docs/SURFACE_DATA.md`, `docs/REGIONAL_CHANGE.md`, and `docs/TEST_REPORT.md` for methods, supported inputs, and verification. **Explore demo** remains a separate synthetic numerical example; it is never substituted for current-patient data.
