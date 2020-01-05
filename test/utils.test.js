import '../node_modules/regenerator-runtime/runtime.js';
import '../dist/snjs.js';
import '../node_modules/chai/chai.js';
import './vendor/chai-as-promised-built.js';
import Factory from './lib/factory.js';

chai.use(chaiAsPromised);
var expect = chai.expect;

describe('utils', () => {

  it("findInArray", async () => {
    expect(findInArray).to.not.be.null;
    let array = [{id: 1},{id: 2},{id: 3},{id: 4}]
    expect(findInArray(array, "id", 1)).to.be.ok;
    expect(findInArray(array, "id", "foo")).to.not.be.ok;
  })

  it('isNullOrUndefined', () => {
    expect(isNullOrUndefined(null)).to.equal(true);
    expect(isNullOrUndefined(undefined)).to.equal(true);
    expect(isNullOrUndefined(1)).to.equal(false);
    expect(isNullOrUndefined("foo")).to.equal(false);
    expect(isNullOrUndefined({})).to.equal(false);
    expect(isNullOrUndefined([null])).to.equal(false);
  })

  it('extendArray', () => {
    const array = [1, 2, 3];
    const original = array.slice();
    const extended = [4, 5, 6];
    extendArray(array, extended);
    expect(array).to.eql(original.concat(extended));
  })

  it('subtractFromArray', () => {
    const array = [1, 2, 3, 4, 5];
    subtractFromArray(array, [1, 3, 5]);
    expect(array).to.eql([2, 4]);
  })

  it('removeFromIndex', () => {
    const array = [1, 2, 3];
    removeFromIndex(array, 1);
    expect(array).to.eql([1, 3]);
  })

  it('arrayByDifference', () => {
    const array = [1, 2, 3, 4];
    const array2 = [2, 3];
    const result = arrayByDifference(array, array2);
    expect(result).to.eql([1, 4]);
  })

  it('lodash merge should behave as expected', () => {
    const a = {
      content: {
        references: [{a: "a"}]
      }
    }

    const b = {
      content: {
        references: [ ]
      }
    }

    // merging a with b should replace total content
    deepMerge(a, b);
    expect(a.content.references).to.eql([]);
  });
});