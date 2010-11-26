set :application, "trss"
set :host, "twitterrsslinks.com"

set :scm, :git
set :scm_verbose, true
set :repository, "git://github.com/rubenfonseca/twitter-streamer-hub.git"
set :branch, "master"

set :node_file, "server.js"

set :deploy_to, "/home/ubuntu/trss"
set :deploy_via, :remote_cache

role :app, host
set :user, 'ubuntu'
set :runner, 'ubuntu'
set :use_sudo, true
default_run_options[:pty] = true

namespace :deploy do
  task :start, :roles => :app, :except => { :no_release => true } do
    run "#{try_sudo :as => 'root'} start #{application}"
  end
  
  task :stop, :roles => :app, :except => { :no_release => true } do
    run "#{try_sudo :as => 'root'} stop #{application}"
  end
  
  task :restart, :roles => :app, :except => { :no_release => true } do
    run "#{try_sudo :as => 'root'} restart #{application} || #{try_sudo :as => 'root'} start #{application}"
  end
  
  task :bundle_npm, :roles => :app do
    run "cd #{release_path} && npm bundle ./vendor"
  end
  
  task :create_deploy_to_with_sudo, :roles => :app do
    run "#{try_sudo :as => 'root'} mkdir -p #{deploy_to}"
    run "#{try_sudo :as => 'root'} chown #{runner}:#{runner} #{deploy_to}"
  end
  
  task :write_upstart_script, :roles => :app do
    upstart_script = <<-UPSTART
description "#{application}"
  
start on startup
stop on shutdown
  
script
  export HOME="/home/#{runner}"
    
  cd #{current_path}
  exec sudo -u #{user} sh -c "/usr/local/bin/node #{current_path}/#{node_file} twitterrsslinks.com 80 >> #{shared_path}/log/#{application}.log 2>&1"
end script
respawn
UPSTART

    put upstart_script, "/tmp/#{application}_upstart.conf"
    run "#{try_sudo :as => 'root'} mv /tmp/#{application}_upstart.conf /etc/init/#{application}.conf"
  end
end

before 'deploy:setup', 'deploy:create_deploy_to_with_sudo'
after 'deploy:setup', 'deploy:write_upstart_script'
after 'deploy:update_code', 'deploy:bundle_npm'
