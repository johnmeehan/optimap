require 'spec_helper'
require 'uri'

RSpec.describe OptiMapApp do
  include Rack::Test::Methods

  def app
    OptiMapApp
  end

  # ---------------------------------------------------------------------------
  # GET /
  # ---------------------------------------------------------------------------
  describe 'GET /' do
    it 'returns HTTP 200' do
      get '/'
      expect(last_response.status).to eq(200)
    end

    it 'renders a page containing the map div' do
      get '/'
      expect(last_response.body).to include('id="map"')
    end

    it 'does not include addAddressAndLabel when no loc params given' do
      get '/'
      expect(last_response.body).not_to include('addAddressAndLabel')
    end

    it 'includes addAddressAndLabel for each location with its name' do
      get '/?loc0=Boston&name0=Home&loc1=NYC&name1='
      expect(last_response.body).to include("addAddressAndLabel('Boston', 'Home')")
      expect(last_response.body).to include("addAddressAndLabel('NYC', '')")
    end

    it 'stops adding addresses at the first missing loc' do
      get '/?loc0=Boston&loc2=NYC'
      expect(last_response.body).to include("addAddressAndLabel('Boston'")
      expect(last_response.body).not_to include("addAddressAndLabel('NYC'")
    end

    it 'includes directions() call when locations are present' do
      get '/?loc0=Boston&loc1=NYC'
      expect(last_response.body).to include('directions(')
    end

    it 'does not include server-generated directions() call when no locations are present' do
      get '/'
      # The button onClick handlers always contain `directions(`, but the
      # server-generated init() call (with boolean args) must not be present.
      expect(last_response.body).not_to include('directions(0, false')
    end

    it 'renders loadAtStart with parsed center coordinates' do
      get '/?center=(40.7128,-74.0060)&zoom=10'
      expect(last_response.body).to include('loadAtStart(40.7128, -74.0060, 10)')
    end

    it 'renders client-location fallback when center is absent' do
      get '/?zoom=8'
      expect(last_response.body).to include('google.loader.ClientLocation')
    end

    it 'uses default zoom of 8 when zoom param is absent' do
      get '/'
      expect(last_response.body).to include('loadAtStart(37.4419, -122.1419, 8)')
    end

    it 'passes walk=true to directions() when walk param is non-zero' do
      get '/?loc0=A&loc1=B&walk=1'
      expect(last_response.body).to include('directions(0, true,')
    end

    it 'passes avoidTolls=true to directions() when avoidTolls param is non-zero' do
      get '/?loc0=A&loc1=B&avoidTolls=1'
      # avoidTolls is the 5th argument; the whole call should end with true
      expect(last_response.body).to match(/directions\(.*true\)/)
    end

    it 'returns content-type text/html' do
      get '/'
      expect(last_response.content_type).to include('text/html')
    end
  end

  # ---------------------------------------------------------------------------
  # GET /tomtom
  # ---------------------------------------------------------------------------
  describe 'GET /tomtom' do
    context 'when no itn param is given' do
      it 'returns 200 with no error and no download link' do
        get '/tomtom'
        expect(last_response.status).to eq(200)
        expect(last_response.body).not_to include('too large')
        expect(last_response.body).not_to include('addtotomtom')
      end
    end

    context 'when itn is 10000 characters or more' do
      it 'returns 200 and shows error message' do
        get "/tomtom?itn=#{'x' * 10_000}"
        expect(last_response.status).to eq(200)
        expect(last_response.body).to include('too large')
      end

      it 'does not write any files' do
        get "/tomtom?itn=#{'x' * 10_000}"
        written = Dir.glob(File.join(OptiMapApp.settings.tomtom_dir, '*'))
        expect(written).to be_empty
      end
    end

    context 'when itn is valid (under 10000 chars)' do
      let(:valid_itn) { "200000|100000|Start|4|\n300000|400000|End|2|\n" }

      before do
        allow_any_instance_of(OptiMapApp).to receive(:system) { true }
        get "/tomtom?itn=#{URI.encode_www_form_component(valid_itn)}"
      end

      it 'returns HTTP 200' do
        expect(last_response.status).to eq(200)
      end

      it 'renders the Add-To-TomTom button link' do
        expect(last_response.body).to include('addto.tomtom.com')
      end

      it 'renders a download link for the itinerary file' do
        expect(last_response.body).to include('Download itinerary file')
      end

      it 'writes a .itn file to the tomtom dir' do
        itn_files = Dir.glob(File.join(OptiMapApp.settings.tomtom_dir, '*.itn'))
        expect(itn_files).not_to be_empty
      end

      it 'writes a .itn.xml file to the tomtom dir' do
        xml_files = Dir.glob(File.join(OptiMapApp.settings.tomtom_dir, '*.itn.xml'))
        expect(xml_files).not_to be_empty
      end

      it 'writes correct content to the .itn file' do
        itn_file = Dir.glob(File.join(OptiMapApp.settings.tomtom_dir, '*.itn')).first
        expect(File.read(itn_file)).to eq(valid_itn)
      end
    end
  end

  # ---------------------------------------------------------------------------
  # POST /garmin
  # ---------------------------------------------------------------------------
  describe 'POST /garmin' do
    context 'with a valid gpx payload' do
      let(:gpx_content) { '<gpx><rte><rtept lat="1" lon="2"/></rte></gpx>' }

      before { post '/garmin', gpx: gpx_content }

      it 'returns HTTP 200' do
        expect(last_response.status).to eq(200)
      end

      it 'renders the garminDisplay div' do
        expect(last_response.body).to include('id="garminDisplay"')
      end

      it 'injects the gpx content as JSON into the page' do
        expect(last_response.body).to include(gpx_content.to_json)
      end

      it 'renders Export Route and Export Waypoints buttons' do
        expect(last_response.body).to include('Export Route')
        expect(last_response.body).to include('Export Waypoints')
      end

      it 'writes a .gpx file to the tomtom dir' do
        gpx_files = Dir.glob(File.join(OptiMapApp.settings.tomtom_dir, '*.gpx'))
        expect(gpx_files).not_to be_empty
      end
    end

    context 'with both gpx and gpxWp payloads' do
      it 'renders download links for both files' do
        post '/garmin', gpx: '<gpx/>', gpxWp: '<gpx/>'
        expect(last_response.body).to include('Download GPX route file')
        expect(last_response.body).to include('Download GPX waypoints file')
      end
    end

    context 'when gpx payload exceeds 100000 characters' do
      before { post '/garmin', gpx: 'x' * 100_001 }

      it 'does not write a .gpx file' do
        gpx_files = Dir.glob(File.join(OptiMapApp.settings.tomtom_dir, '*.gpx'))
        expect(gpx_files).to be_empty
      end

      it 'does not render a download link for the oversized file' do
        expect(last_response.body).not_to include('Download GPX route file')
      end
    end

    context 'when gpxWp payload exceeds 100000 characters' do
      it 'body contains "too large" indicator (no download link rendered)' do
        post '/garmin', gpxWp: 'x' * 100_001
        expect(last_response.body).not_to include('Download GPX waypoints file')
      end
    end

    context 'when no gpx is submitted' do
      it 'returns 200 without any download links' do
        post '/garmin'
        expect(last_response.status).to eq(200)
        expect(last_response.body).not_to include('Download GPX')
      end
    end

    context 'API key selection based on host' do
      it 'uses www.gebweb.net key when host is www.gebweb.net' do
        post '/garmin', { gpx: '<gpx/>' }, 'HTTP_HOST' => 'www.gebweb.net'
        expect(last_response.body).to include('51c2f2096bbdcd6422b5d172c555cacf')
      end

      it 'uses optimap.net key as default for unknown host' do
        post '/garmin', { gpx: '<gpx/>' }, 'HTTP_HOST' => 'localhost'
        expect(last_response.body).to include('5e9f01f368a532d706d5418ab7f1a069')
      end
    end
  end
end
