require 'sinatra/base'
require 'json'
require 'fileutils'
require 'shellwords'

class OptiMapApp < Sinatra::Base
  set :views,         File.join(__dir__, 'views')
  set :public_folder, __dir__
  set :tomtom_dir,    File.join(__dir__, 'tomtom')

  # ---------------------------------------------------------------------------
  # Routes
  # ---------------------------------------------------------------------------

  get '/' do
    @locations   = parse_locations(params)
    @center      = parse_center(params)
    @zoom        = params.fetch('zoom', '8')
    @mode        = params.fetch('mode', '0')
    @walk        = params.fetch('walk', '0')
    @bike        = params.fetch('bike', '0')
    @avoid       = params.fetch('avoid', '0')
    @avoid_tolls = params.fetch('avoidTolls', '0')

    # PHP always sets hidePoll1=true regardless of cookie presence
    @hide_poll1 = true
    @hide_poll2 = request.cookies.key?('poll2Hidden')

    @bptsp_mtime  = file_mtime('js/BpTspSolver.js')
    @direxp_mtime = file_mtime('js/directions-export.js')
    @tsp_mtime    = file_mtime('js/tsp.js')

    erb :index
  end

  get '/tomtom' do
    itn = params['itn']

    if itn.nil?
      @error = nil
      @fname = nil
      return erb :tomtom
    end

    if itn.length >= 10_000
      @error = 'Itinerary is too large!'
      @fname = nil
      return erb :tomtom
    end

    date_token = Time.now.strftime('%Y%m%d')
    rnd_token  = rand(100_000_000..999_999_999).to_s
    sub_dir    = ''
    basename   = "#{date_token}#{rnd_token}"
    abs_fname  = File.join(settings.tomtom_dir, "#{basename}.itn")
    rel_fname  = "tomtom/#{basename}.itn"

    FileUtils.mkdir_p(settings.tomtom_dir)
    File.write(abs_fname, itn)
    system('zip', '-j', "#{abs_fname}.zip", abs_fname)

    xml = generate_tomtom_xml(
      itn:        itn,
      fname:      rel_fname,
      sub_dir:    sub_dir,
      date_token: date_token,
      rnd_token:  rnd_token
    )
    File.write("#{abs_fname}.xml", xml)

    @error      = nil
    @fname      = abs_fname
    @sub_dir    = sub_dir
    @date_token = date_token
    @rnd_token  = rnd_token

    erb :tomtom
  end

  post '/garmin' do
    gpx    = params['gpx']
    gpx_wp = params['gpxWp']

    api_info     = select_garmin_api_key(request.host)
    @api_domain  = api_info[:domain]
    @api_key     = api_info[:key]
    @gpx_json    = gpx.to_json
    @gpx_wp_json = gpx_wp.to_json

    sub_dir    = ''
    date_token = Time.now.strftime('%Y%m%d')
    rnd_token  = rand(100_000_000..999_999_999).to_s
    @download_links = []

    FileUtils.mkdir_p(settings.tomtom_dir)
    basename = "#{date_token}#{rnd_token}"

    if gpx && gpx.length < 100_000
      rel_fname = "tomtom/#{basename}.gpx"
      File.write(File.join(settings.tomtom_dir, "#{basename}.gpx"), gpx)
      @download_links << {
        href: "http://www.gebweb.net/optimap/#{sub_dir}#{rel_fname}",
        text: 'Download GPX route file'
      }
    end

    if gpx_wp && gpx_wp.length < 100_000
      rel_fname = "tomtom/#{basename}.wp.gpx"
      File.write(File.join(settings.tomtom_dir, "#{basename}.wp.gpx"), gpx_wp)
      @download_links << {
        href: "http://www.gebweb.net/optimap/#{sub_dir}#{rel_fname}",
        text: 'Download GPX waypoints file'
      }
    end

    erb :garmin
  end

  # ---------------------------------------------------------------------------
  # Pure helper methods (no I/O, unit-testable)
  # ---------------------------------------------------------------------------

  # Returns an array of {addr:, name:} hashes.
  # Stops at the first missing or empty loc<N> param, mirroring PHP behaviour.
  def parse_locations(params)
    locations = []
    num = 0
    loop do
      loc = params["loc#{num}"]
      break if loc.nil? || loc.empty?
      name = params.fetch("name#{num}", '')
      locations << { addr: loc, name: name }
      num += 1
    end
    locations
  end

  # Returns {lat:, lng:} or nil.
  #
  # PHP split("[\s,\)\(]+", "(40.7, -74.0)") → ["", "40.7", "-74.0", ""]
  # Ruby "(40.7, -74.0)".split(/[\s,)(]+/)   → ["", "40.7", "-74.0"]
  # (Ruby drops trailing empty strings but keeps leading ones)
  # So parts[1]=lat, parts[2]=lng — same offsets as PHP.
  def parse_center(params)
    return nil unless params.key?('center')
    loc = params['center']
    pattern = /\(\s*-?(?:[0-9]+|[0-9]*\.[0-9]+),\s*-?(?:[0-9]+|[0-9]*\.[0-9]+)\)/i
    return nil unless loc.match?(pattern)
    parts = loc.split(/[\s,)(]+/)
    { lat: parts[1], lng: parts[2] }
  end

  # Returns {domain:, key:} for the appropriate Garmin API credentials.
  # Replicates PHP strpos-based precedence: independent if-blocks, last match wins.
  # PHP checks: gebweb.net, www.gebweb.net, www.optimap.net — each can overwrite the previous.
  # Effective priority: www.gebweb.net > www.optimap.net > gebweb.net > default (optimap.net).
  def select_garmin_api_key(server_name)
    result = { domain: 'optimap.net', key: '5e9f01f368a532d706d5418ab7f1a069' }
    result = { domain: 'gebweb.net',      key: 'c0bcc979825cde992937b2d732343b9c' } if server_name.include?('gebweb.net')
    result = { domain: 'www.gebweb.net',  key: '51c2f2096bbdcd6422b5d172c555cacf' } if server_name.include?('www.gebweb.net')
    result = { domain: 'www.optimap.net', key: '39029a66ad579141aa9de7a43b3558eb' } if server_name.include?('www.optimap.net')
    result
  end

  # Returns the TomTom XML metadata string.
  # Pure: takes all inputs explicitly, performs no I/O.
  # <size> is the byte length of the raw itn content, matching PHP strlen().
  def generate_tomtom_xml(itn:, fname:, sub_dir:, date_token:, rnd_token:)
    idstr        = "OptiMap #{date_token}#{rnd_token}"
    size         = itn.bytesize
    download_url = "http://www.gebweb.net/optimap/#{sub_dir}#{fname}.zip"

    <<~XML
      <?xml version='1.0' encoding='utf-8' ?>
      <item>
      <itinerary idstr='#{idstr}' version='1'>
      <start>Home</start>
      <finish>Home</finish>
      <distance km='0' />
      <title mimetype='text/plain'>OptiMap route</title>
      <description mimetype='text/plain'>Route generated by OptiMap</description>
      <size>#{size}</size>
      <download>
      <url location='#{download_url}' content='main' />
      </download>
      <targetdevice models='all' />
      <price free='true' />
      <supplier>
      <name>gebweb.net</name>
      </supplier>
      </itinerary>
      </item>
    XML
  end

  private

  def file_mtime(relative_path)
    path = File.join(__dir__, relative_path)
    File.exist?(path) ? File.mtime(path).to_i : 0
  end
end
