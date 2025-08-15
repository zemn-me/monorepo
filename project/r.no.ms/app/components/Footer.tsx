import { githubRepoUrl } from '#root/ts/constants/constants.js';
import Logo from './Logo';

export default function Footer() {
  return (
    <>
      <label id="qmark" htmlFor="showfooter">?</label>
      <input id="showfooter" type="checkbox" style={{ display: 'none' }} />
      <label htmlFor="showfooter">
        <footer>
          <div>
            <div className="head">
              — <a href="//ve.no.ms" className="img"><Logo /></a> —
            </div>
            <ul>
              <li>
                Click on a field such as resistance, tolerance or a colour to edit it, the band colours will be updated corresponding to the colour on a resistor in real time.
              </li>
              <li>Press this dialog to close it.</li>
              <li>
                Tolerance band 20% is called "transparent" because it was easier to code. "absent", "none" and "empty" also work.
              </li>
              <li>
                Both "10GΩ" and "10 gigaΩ" notations are supported. This is case-sensitive so "10mΩ" will not work.
              </li>
              <li>
                Precision is guessed; 1k and 11k are four band resistors, 111k is five band (usually blue cased in real life). For extra bands, just type a number of non-zero numbers into the resistance input, eg "111" will give you 5 bands.
              </li>
              <li>
                If an invalid resistor is entered based on colour, the center bar will have an outline.
              </li>
              <li>
                The mobile version now has a different colour selector where you don’t need to type. It’s possible (and quite easy) to select colours for invalid resistors with this feature, however. Gold and silver are only viable choices for the last band.
              </li>
              <li>
                You can see all the colours by typing 1023456789. Tolerance comes in gold, silver and transparent for 5% 10% 20% respectively.
              </li>
              <li>
                Has an icon assigned for adding to your iOS homepage. Press the up arrow in a box icon in Safari.
              </li>
              <li>
                Some older versions of iOS do not support contentEditable, an HTML5 technology which is used for input here, check <a href="http://caniuse.com/#feat=contenteditable">here</a> for a list of supported / unsupported browsers
              </li>
              <li>
                There's a fairly useful JavaScript API for dealing with resistors. Use the exported Resistor class to create new objects and call <code>Resistor.bands()</code> to get the coloured bands.
              </li>
              <li>
                The full code is on github{' '}
                <a href={`${githubRepoUrl}/tree/main/project/r.no.ms`}>here</a>, I’m happy to take issues and pull requests there.
              </li>
            </ul>
            <div id="diagram"></div>
          </div>
        </footer>
      </label>
    </>
  );
}
