var IMHWPB = IMHWPB || {};

IMHWPB.StockImageSearch = function( configs, $ ) {
	var self = this;

	this.configs = configs;

	this.api_url = this.configs.asset_server;
	this.api_key = this.configs.api_key;

	this.api_param = 'key';
	this.api_key_query_str = this.api_param + "=" + this.api_key;

	this.last_query = '';
	this.page = 1;

	// include additional submodules
	self.ajax = new IMHWPB.Ajax( configs );
	self.baseAdmin = new IMHWPB.BaseAdmin();

	$c_imhmf = jQuery( '.imhwpb-media-frame' );
	$c_sr = jQuery( '#search_results', $c_imhmf );

	jQuery( function() {
		// When the page has finished loading, enable the search button.
		$( '#image_search .button-primary', $c_imhmf ).prop( 'disabled', false );

		// event handler: user clicks search
		jQuery( '#image_search', $c_imhmf ).on( 'submit', function() {
			self.initiate_stock_image_search();
			return false;
		} );

		// event handler: user filters by license attribution
		jQuery( '#attribution', $c_imhmf ).on( 'click', function( value ) {
			self.toggle_search_results_by_requires_attribution();
		} );

		jQuery( '#search_results', $c_imhmf ).scroll( function() {
			self.search_results_scroll();
		} );
	} );

	// this function is triggered by the click/button/search event handler
	this.initiate_stock_image_search = function() {
		var query = jQuery( '#media-search-input', $c_imhmf ).val();

		// if we're searching for a different word, reset the search
		if ( self.last_query != '' && query != self.last_query ) {
			self.reset_search();
		}
		self.last_query = query;

		// prevent empty searches
		if ( query.trim() == '' ) {
			alert( "Please enter a search term." );
			return false;
		}

		// Are we already search?
		if ( 1 == self.currently_searching ) {
			return false;
		} else {
			self.currently_searching = 1;
		}

		// Show "searching" message
		if ( self.page == 1 ) {
			jQuery( $c_sr ).append( "<div class='loading_message pointer'>Searching...</div>" );
		} else {
			jQuery( '.loading_message', $c_sr ).html( "Searching..." );
		}

		// setup our variables
		var data = {
			'query' : query,
			'free' : jQuery( '#free', $c_imhmf ).val(),
			'attribution' : jQuery( '#attribution', $c_imhmf ).is( ':checked' ),
			'paid' : jQuery( '#paid', $c_imhmf ).val(),
			'palette' : jQuery( '#palette', $c_imhmf ).val(),
			'page' : self.page,
		};

		var api_call_image_search_success_action = function( msg ) {
			// if we have search results
			if ( msg.result.data.length > 0 ) {
				var source = jQuery( "#search-results-template" ).html();
				var template = Handlebars.compile( source );
				jQuery( '#search_results', $c_imhmf ).append( template( msg.result ) );

				// event handler: user clicks search result
				jQuery( 'li.attachment', $c_imhmf ).on( 'click', function() {
					self.event_handler_search_result_click( this );
				} );

				var $search_results = jQuery( '#search_results', $c_imhmf );

				jQuery( '.loading_message', $c_sr )
				    .appendTo( $c_sr )
				    .css( 'display', 'inherit' )
				    .html(
				        '<strong>Scroll down</strong> or <strong>click here</strong> to load more search results' )
				    .on( 'click', function() {
					    self.initiate_stock_image_search();
					    return false;
				    } );

				// update the page value (page number for pagination)
				self.page++;

				// else [we have no search results]
			} else {
				var $search_results = jQuery( '#search_results', $c_imhmf );

				if ( '1' == self.page ) {
					var message = 'No search results.';
				}

				var no_search_results = '1' == self.page ? 'No search results'
				    : 'No more search results';

				jQuery( '.loading_message', $c_sr ).appendTo( $c_sr ).css( 'display', 'inherit' )
				    .html( no_search_results );
			}

			self.currently_searching = 0;

			// Toggle attribution:
			self.toggle_search_results_by_requires_attribution();
		};

		self.ajax.ajaxCall( data, 'image_search', api_call_image_search_success_action );
	};

	/**
	 *
	 */
	this.event_handler_search_result_click = function( result ) {
		var image_provider_id = jQuery( result ).data( 'image-provider-id' );
		var id_from_provider = jQuery( result ).data( 'id-from-provider' );

		var attachment_details = jQuery( '#attachment_details', $c_imhmf );

		// show loading message...
		jQuery( attachment_details )
		    .empty()
		    .html(
		        "<div class='loading_message white-bg'><span class='spinner is-active'></span>Loading image details</div>" );

		/**
		 * Toggle 'details selected' classes
		 */
		jQuery( 'li.attachment', $c_imhmf ).each( function() {
			if ( this != result ) {
				jQuery( this ).removeClass( 'details selected' );
			}
		} );
		jQuery( result ).toggleClass( 'details selected' );

		// configure data to send with ajax request
		var data = {
		    'image_provider_id' : image_provider_id,
		    'id_from_provider' : id_from_provider
		};

		// after ajax command, run this
		var api_call_image_get_details_success_action = function( msg ) {
			/*
			 * Determine if we had a successful call. Currently determined by
			 * whether or not an array of downloadable sizes was returned.
			 */
			var sizes = msg.result.data.sizes;
			var has_sizes = ( true == jQuery.isArray( sizes ) && 0 < jQuery( sizes ).length ) ? true
			    : false;

			if ( true === has_sizes ) {
				/*
				 * We successfully fetched the details of the image. Display
				 * those attachment details for the user.
				 */
				var source = jQuery( "#attachment-details-template" ).html();
				var template = Handlebars.compile( source );
				jQuery( '#attachment_details', $c_imhmf ).html( template( msg.result.data ) );

				// PreSelect Alignment if replacing an image
				self.select_image_alignment();

				/**
				 * Display the pointer if applicable.
				 */
				if ( typeof WPHelpPointerIndex != 'undefined' ) {
					var pointer_index = WPHelpPointerIndex[ '#image_size' ];
					if ( typeof pointer_index != 'undefined' ) {
						if ( 'yes' != WPHelpPointer.pointers[ pointer_index ][ 'is-dismissed' ] ) {
							setTimeout( function() {
								self.baseAdmin
								    .show_pointer( jQuery( '#imaeg_size' ), '#image_size' );
							}, 1000 );
						}
					}
				}

				// event handler: user clicks "Insert into page"
				jQuery( '#download_and_insert_into_page' ).on( 'click', function() {
					self.download( $( this ) );
				} );
			} else {
				/*
				 * There was an issue fetching the image details. Display an
				 * applicable message.
				 */
				var source = jQuery( "#attachment-details-error-template" ).html();
				var template = Handlebars.compile( source );
				jQuery( '#attachment_details', $c_imhmf ).html( template() );
			}

		};

		/**
		 * ajax / reach out for the attachment details
		 */
		self.ajax.ajaxCall( data, 'image_get_details', api_call_image_get_details_success_action );

	};

	/**
	 * @summary Determine where we are downloading an image from.
	 *
	 * For example, we can be downloading it from within the Customizer, Dashboard > Media, etc.
	 *
	 * @since 1.1.9
	 *
	 * @return string.
	 */
	this.getAction = function() {
		var inCustomizer = ( 'dashboard-customizer' === self.baseAdmin.GetURLParameter( 'ref' ) ),
			action = null;

		if ( typeof parent.wp.media.frame !== 'undefined' && 'replace-image' === parent.wp.media.frame._state ) {
			action = 'replace-image';
		} else if( typeof parent.window.send_to_editor === 'function' && false === inCustomizer ) {
			action = 'editor';
		} else if( 'dashboard-media' === self.baseAdmin.GetURLParameter( 'ref' ) ) {
			action = 'dashboard-media';
		} else if( true === inCustomizer ) {
			action = 'customizer';
		}

		return action;
	}

	/**
	 * Set the alignment to the current image's alignment
	 */
	this.select_image_alignment = function() {

		if ( parent.tinymce && parent.tinymce.activeEditor ) {
			var $current_selection = jQuery( parent.tinymce.activeEditor.selection.getNode() );
			var $alignment_sidebar = jQuery( '.attachments-browser select.alignment' );

			// Determine if the current selection has a class.
			if ( $current_selection.is( 'img' ) ) {
				var classes = $current_selection.attr( 'class' );
				var current_classes = [];
				if ( classes ) {
					current_classes = $current_selection.attr( 'class' ).split( /\s+/ );
				}

				var value_selection = 'none';
				jQuery.each( current_classes, function( index, class_item ) {
					if ( class_item == "aligncenter" ) {
						value_selection = "center";
						return false;
					} else if ( class_item == "alignnone" ) {
						value_selection = "none";
						return false;
					} else if ( class_item == "alignright" ) {
						value_selection = "right";
						return false;
					} else if ( class_item == "alignleft" ) {
						value_selection = "left";
						return false;
					}
				} );

				if ( $alignment_sidebar.length ) {
					$alignment_sidebar.val( value_selection ).change();
				}
			}
		}
	};

	/**
	 * @summary Download an image from the search results.
	 *
	 * @since 1.1.9
	 *
	 * @param jQuery object $anchor The "Download" button the user clicked.
	 */
	this.download = function( $anchor ) {
		var $c_ad = $( '#attachment_details' ),
			$image_size_option_selected = $( '#image_size option:selected', $c_imhmf ),
			// Are we currently downloading an image?
			$currently_downloading = $( '#currently_downloading_image', $c_ad );

		// Are we already downloading an image? If so, abort. Else, flag that we are.
		if ( '1' === $currently_downloading.val() ) {
			return;
		} else {
			$currently_downloading.val( '1' );
		}

		$anchor.attr( 'disabled', true ).text( "Downloading image..." );

		var data = {
		    'action' : 'download_and_insert_into_page',
		    'id_from_provider' : jQuery( '#id_from_provider', $c_imhmf ).val(),
		    'image_provider_id' : jQuery( '#image_provider_id', $c_imhmf ).val(),
		    'image_size' : jQuery( '#image_size', $c_imhmf ).val(),
		    'post_id' : IMHWPB.post_id,
		    'title' : jQuery( '#title', $c_ad ).val(),
		    'caption' : jQuery( '#caption', $c_ad ).val(),
		    'alt_text' : jQuery( '#alt_text', $c_ad ).val(),
		    'description' : jQuery( '#description', $c_ad ).val(),
		    'alignment' : jQuery( '#alignment', $c_ad ).val(),
		    'width' : $image_size_option_selected.attr( 'data-width' ),
		    'height' : $image_size_option_selected.attr( 'data-height' ),
		};

		jQuery.post( ajaxurl, data, function( response ) {
			response = JSON.parse( response );

			$anchor.text( "Image downloaded!" );

			self.downloadSuccess( response, $anchor );
		});
	};

	/**
	 * Take different actions based upon where we're downloading the image from.
	 *
	 * @since 1.1.9
	 *
	 * @param object        response Our response from ajax / downloading our image.
	 * @param jQuery object $anchor   A reference to our Download button.
	 */
	this.downloadSuccess = function( response, $anchor ) {
		var action = self.getAction();

		switch( action ) {
			case 'replace-image':

				self.refresh_media_library();
				self.whenInLibrary( response.attachment_id, action );

				break;
			case 'editor':

				parent.window.send_to_editor( response.html_for_editor );

				break;
			case 'dashboard-media':

				var anchor_to_view_attachment_details_media_library = '<a href="post.php?post='
		            + response.attachment_id
		            + '&action=edit" target="_parent" class="button button-small view-image-in-library">View image in Media Library</a>';

		        $anchor.after( anchor_to_view_attachment_details_media_library );

				break;
			case 'customizer':

				self.refresh_media_library();
	        	self.whenInLibrary( response.attachment_id, action );

				break;
		};
	}

	/**
	 * Refresh the images in the library.
	 */
	this.refresh_media_library = function() {
		var haveCollection = ( typeof window.parent.wp.media.frame.content.get().collection !== 'undefined' ),
		// Do we have a library?
		haveLibrary = typeof window.parent.wp.media.frame.library !== 'undefined';

		if ( window.parent.wp.media.frame.content.get() !== null && haveCollection ) {
			window.parent.wp.media.frame.content.get().collection.props.set( {
				ignore : ( +new Date() )
			} );
			window.parent.wp.media.frame.content.get().options.selection.reset();
		} else if ( haveLibrary ) {
			window.parent.wp.media.frame.library.props.set( {
				ignore : ( +new Date() )
			} );
		}
	};

	/**
	 *
	 */
	this.reset_search = function() {
		self.page = 1;
		self.last_query = '';

		jQuery( $c_sr ).empty();
	};

	/**
	 *
	 */
	this.search_results_scroll = function() {
		var scrollTop = jQuery( '#search_results', $c_imhmf ).scrollTop();
		var height = jQuery( '#search_results', $c_imhmf ).height();
		var scrollHeight = jQuery( '#search_results', $c_imhmf )[ 0 ].scrollHeight;
		var pixels_bottom_unseen = scrollHeight - height - scrollTop;
		var loading_message_outer_height = jQuery( '.loading_message', $c_sr ).outerHeight( false );

		if ( pixels_bottom_unseen <= loading_message_outer_height ) {
			self.initiate_stock_image_search();
		}
	};

	/**
	 *
	 */
	this.toggle_search_results_by_requires_attribution = function() {
		// determine whether or not "Attribution" is checked
		need_to_show = jQuery( '#attribution', $c_imhmf ).is( ':checked' );

		// loop through each image in the search results
		jQuery( "#search_results li", $c_imhmf ).each( function( index, li ) {
			// grab the value of "data-requires-attribution"
			var li_requires_attribution = jQuery( li ).data( 'requires-attribution' );

			// if this image requires attribution
			if ( '1' == li_requires_attribution ) {
				// If the user checked "attribution"
				if ( true == need_to_show ) {
					// then fade this image in
					jQuery( li ).fadeIn();
					// else [the user unchecked "attribution"
				} else {
					// then fade this image out
					jQuery( li ).fadeOut();
				}
			}
		} );
	};

	/**
	 * @summary Take action when an image is found in the Media Library.
	 *
	 * This method is triggered after we have downloaded an image. We wait for the new image to
	 * appear in the Media Library, then we take action.
	 *
	 * This method uses an Interval to check the Media Library for the new image. The Interval is
	 * used as there does not seem to be an action triggered after a successful Media Library refresh.
	 *
	 * @since 1.1.9
	 *
	 * @param int attachmentId ID of the attachment we're looking for.
	 * @param string action The location we're downloading the image from. For example, Customizer.
	 */
	this.whenInLibrary = function( attachmentId, action ) {
		var
			// How much time has elapsed since we began looking for the image?
			elapsed = 0,
			// Wait up to 10 seconds for the new image to appear in the  library.
			elapsedLimit = 10000,
			// Has the new image been found in the library?
			found,
			// How often should we check to see if the new image is in the library.
			interval = 100,
			// An Interval to check for the new image in the library
			checkInLibrary,
			// A reference to the attachment in the library.
			$attachment;

		checkInLibrary = setInterval( function() {
			// Has our attachment been found in the Media Library?
			found = ( $( '.attachments', window.parent.document ).children( "[data-id=" + attachmentId + "]" ).length > 0 );

			/*
			 * Take action based upon whether or not our new image is in the Media Library.
			 *
			 * If the image has been found:
			 * # Clear the interval, no need to keep looking.
			 * # Run additional actions based upon whether we're in the customizer or replacing an image.
			 *
			 * Else:
			 * # Increase the elapsed time. If we've reached our limit, clear the interval and abort.
			 */
			if( found ) {
				clearInterval( checkInLibrary );

				$attachment = $( '.attachments', window.parent.document ).children( "[data-id=" + attachmentId + "]" ).find( '.attachment-preview' );

				switch( action ) {
					case 'replace-image':

						// In the media library, click the image we just downloaded, then click 'Replace'.
				        $attachment.click();
				        $( '.media-button-replace', window.parent.document ).click();

						break;

					case 'customizer':

						/*
						 * Make sure the toolbar at the bottom is visible. After selecting the image,
						 * we'll be cropping it. We'll need to see the buttons for 'crop / not now'.
						 */
						$( '.media-modal:visible', window.parent.document ).find( '.media-frame-toolbar' ).removeClass( 'hidden' );

						// In the media library, click the image that was just downloaded. Then, click the select button.
						$attachment.click();
						$( '.media-button-select', window.parent.document ).click();

						break;
				}
			} else {
				elapsed += interval;

				if( elapsed >= elapsedLimit ) {
					clearInterval( checkInLibrary );
				}
			}
		}, interval );
	}
};

new IMHWPB.StockImageSearch( IMHWPB.configs, jQuery );
