require 'spec_helper'

RSpec.describe OptiMapApp do
  # Sinatra::Base.new! creates a plain app instance for unit-testing helper methods
  # directly without going through the HTTP/rack stack.
  subject(:app_instance) { OptiMapApp.new! }

  # ---------------------------------------------------------------------------
  # parse_locations
  # ---------------------------------------------------------------------------
  describe '#parse_locations' do
    it 'returns an empty array when no loc params are present' do
      expect(app_instance.parse_locations({})).to eq([])
    end

    it 'parses a single location without a name' do
      result = app_instance.parse_locations('loc0' => 'Boston')
      expect(result).to eq([{ addr: 'Boston', name: '' }])
    end

    it 'parses a single location with a name' do
      result = app_instance.parse_locations('loc0' => 'Boston', 'name0' => 'Home')
      expect(result).to eq([{ addr: 'Boston', name: 'Home' }])
    end

    it 'parses multiple locations in order' do
      params = {
        'loc0'  => 'Boston',      'name0' => 'Home',
        'loc1'  => 'New York',    'name1' => 'Office',
        'loc2'  => 'Philadelphia','name2' => ''
      }
      result = app_instance.parse_locations(params)
      expect(result).to eq([
        { addr: 'Boston',        name: 'Home'   },
        { addr: 'New York',      name: 'Office' },
        { addr: 'Philadelphia',  name: ''       }
      ])
    end

    it 'stops at the first missing loc param (gap in sequence)' do
      result = app_instance.parse_locations('loc0' => 'Boston', 'loc2' => 'NYC')
      expect(result).to eq([{ addr: 'Boston', name: '' }])
    end

    it 'stops at the first empty loc param, consistent with PHP behaviour' do
      result = app_instance.parse_locations('loc0' => 'Boston', 'loc1' => '')
      expect(result).to eq([{ addr: 'Boston', name: '' }])
    end

    it 'defaults name to empty string when name param is absent' do
      result = app_instance.parse_locations('loc0' => 'Boston', 'loc1' => 'NYC')
      expect(result.map { |l| l[:name] }).to all(eq(''))
    end
  end

  # ---------------------------------------------------------------------------
  # parse_center
  # ---------------------------------------------------------------------------
  describe '#parse_center' do
    it 'returns nil when center param is absent' do
      expect(app_instance.parse_center({})).to be_nil
    end

    it 'returns nil when center param does not match the pattern' do
      expect(app_instance.parse_center('center' => '40.7128,-74.0060')).to be_nil
    end

    it 'returns nil for a bare number' do
      expect(app_instance.parse_center('center' => '40')).to be_nil
    end

    it 'parses a valid center with no spaces' do
      result = app_instance.parse_center('center' => '(40.7128,-74.0060)')
      expect(result).to eq({ lat: '40.7128', lng: '-74.0060' })
    end

    it 'parses a valid center with a space after the comma' do
      result = app_instance.parse_center('center' => '(40.7128, -74.0060)')
      expect(result).to eq({ lat: '40.7128', lng: '-74.0060' })
    end

    it 'parses integer coordinates' do
      result = app_instance.parse_center('center' => '(60,10)')
      expect(result).to eq({ lat: '60', lng: '10' })
    end

    it 'handles negative latitude' do
      result = app_instance.parse_center('center' => '(-33.8688,151.2093)')
      expect(result).to eq({ lat: '-33.8688', lng: '151.2093' })
    end

    it 'handles both coordinates negative' do
      result = app_instance.parse_center('center' => '(-33.8,-70.6)')
      expect(result).to eq({ lat: '-33.8', lng: '-70.6' })
    end
  end

  # ---------------------------------------------------------------------------
  # select_garmin_api_key
  # ---------------------------------------------------------------------------
  describe '#select_garmin_api_key' do
    it 'returns optimap.net key as default for unknown host' do
      result = app_instance.select_garmin_api_key('localhost')
      expect(result[:domain]).to eq('optimap.net')
      expect(result[:key]).to eq('5e9f01f368a532d706d5418ab7f1a069')
    end

    it 'returns optimap.net key for optimap.net host' do
      result = app_instance.select_garmin_api_key('optimap.net')
      expect(result[:domain]).to eq('optimap.net')
      expect(result[:key]).to eq('5e9f01f368a532d706d5418ab7f1a069')
    end

    it 'returns www.optimap.net key for www.optimap.net host' do
      result = app_instance.select_garmin_api_key('www.optimap.net')
      expect(result[:domain]).to eq('www.optimap.net')
      expect(result[:key]).to eq('39029a66ad579141aa9de7a43b3558eb')
    end

    it 'returns gebweb.net key for gebweb.net host' do
      result = app_instance.select_garmin_api_key('gebweb.net')
      expect(result[:domain]).to eq('gebweb.net')
      expect(result[:key]).to eq('c0bcc979825cde992937b2d732343b9c')
    end

    it 'returns www.gebweb.net key for www.gebweb.net host' do
      result = app_instance.select_garmin_api_key('www.gebweb.net')
      expect(result[:domain]).to eq('www.gebweb.net')
      expect(result[:key]).to eq('51c2f2096bbdcd6422b5d172c555cacf')
    end

    it 'prefers www.gebweb.net over gebweb.net when host is www.gebweb.net' do
      result = app_instance.select_garmin_api_key('www.gebweb.net')
      expect(result[:domain]).to eq('www.gebweb.net')
    end

    it 'returns default key for an empty string host' do
      result = app_instance.select_garmin_api_key('')
      expect(result[:domain]).to eq('optimap.net')
    end
  end

  # ---------------------------------------------------------------------------
  # generate_tomtom_xml
  # ---------------------------------------------------------------------------
  describe '#generate_tomtom_xml' do
    let(:itn_content) { "50000|100000|Start|4|\n200000|300000|End|2|\n" }

    let(:xml) do
      app_instance.generate_tomtom_xml(
        itn:        itn_content,
        fname:      'tomtom/20240101123456789.itn',
        sub_dir:    '',
        date_token: '20240101',
        rnd_token:  '123456789'
      )
    end

    it 'starts with an XML declaration' do
      expect(xml).to start_with("<?xml version='1.0' encoding='utf-8' ?>")
    end

    it 'contains <item> root element' do
      expect(xml).to include('<item>')
      expect(xml).to include('</item>')
    end

    it 'contains <itinerary> with correct idstr' do
      expect(xml).to include("idstr='OptiMap 20240101123456789'")
    end

    it 'contains <itinerary> with version 1' do
      expect(xml).to include("version='1'")
    end

    it 'contains correct <size> matching itn byte length' do
      expect(xml).to include("<size>#{itn_content.bytesize}</size>")
    end

    it 'contains the download URL with .zip extension' do
      expect(xml).to include("location='http://www.gebweb.net/optimap/tomtom/20240101123456789.itn.zip'")
    end

    it 'contains <supplier> with gebweb.net name' do
      expect(xml).to include('<name>gebweb.net</name>')
    end

    it 'contains title element' do
      expect(xml).to include("<title mimetype='text/plain'>OptiMap route</title>")
    end

    it 'contains description element' do
      expect(xml).to include("<description mimetype='text/plain'>Route generated by OptiMap</description>")
    end

    it 'incorporates sub_dir into the download URL' do
      xml_with_subdir = app_instance.generate_tomtom_xml(
        itn:        'x',
        fname:      'tomtom/20240101999.itn',
        sub_dir:    'v2/',
        date_token: '20240101',
        rnd_token:  '999'
      )
      expect(xml_with_subdir).to include("location='http://www.gebweb.net/optimap/v2/tomtom/20240101999.itn.zip'")
    end

    it 'uses the raw itn byte length, not zip file size' do
      xml2 = app_instance.generate_tomtom_xml(
        itn: 'x', fname: 'f', sub_dir: '', date_token: 'd', rnd_token: 'r'
      )
      expect(xml2).to include('<size>1</size>')
    end
  end
end
