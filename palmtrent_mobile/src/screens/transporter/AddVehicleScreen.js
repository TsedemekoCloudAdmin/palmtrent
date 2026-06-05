import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TextInput,
  Alert,
  Switch,
  ActivityIndicator,
  Modal,
  FlatList,
  Image,
  Platform
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import apiService from '../../services/apiService';

const OBJECT_ID_PATTERN = /^[0-9a-fA-F]{24}$/;

const isObjectId = (value) => OBJECT_ID_PATTERN.test(String(value || ''));

const referenceKey = (item, prefix) => item?._id || item?.id || item?.code || `${prefix}-${item?.name || Math.random()}`;

const DEFAULT_VEHICLE_TYPES = [
  {
    code: 'single_cab_bakkie',
    name: 'Single Cab Bakkie',
    category: 'bakkie',
    subcategory: 'single_cab',
    description: 'Light delivery bakkie for small loads',
    capacity: { weight: { max: 1, unit: 'tonnes' } },
    isFallback: true
  },
  {
    code: 'double_cab_bakkie',
    name: 'Double Cab Bakkie',
    category: 'bakkie',
    subcategory: 'double_cab',
    description: 'Passenger and light cargo bakkie',
    capacity: { weight: { max: 1.2, unit: 'tonnes' } },
    isFallback: true
  },
  {
    code: 'panel_van',
    name: 'Panel Van',
    category: 'van',
    subcategory: 'panel_van',
    description: 'Enclosed van for parcels and light freight',
    capacity: { weight: { max: 2, unit: 'tonnes' } },
    isFallback: true
  },
  {
    code: '3ton_truck',
    name: '3 Tonne Truck',
    category: 'truck',
    subcategory: '3ton',
    description: 'Small rigid truck for local deliveries',
    capacity: { weight: { max: 3, unit: 'tonnes' } },
    isFallback: true
  },
  {
    code: '5ton_truck',
    name: '5 Tonne Truck',
    category: 'truck',
    subcategory: '5ton',
    description: 'Medium rigid truck for commercial freight',
    capacity: { weight: { max: 5, unit: 'tonnes' } },
    isFallback: true
  },
  {
    code: '10ton_truck',
    name: '10 Tonne Truck',
    category: 'truck',
    subcategory: '10ton',
    description: 'Heavy rigid truck for larger loads',
    capacity: { weight: { max: 10, unit: 'tonnes' } },
    isFallback: true
  },
  {
    code: 'truck_tractor',
    name: 'Truck Tractor',
    category: 'tractor',
    subcategory: 'horse_only',
    description: 'Truck tractor/horse for trailer work',
    capacity: { weight: { max: 34, unit: 'tonnes' } },
    isFallback: true
  }
];

const DEFAULT_VEHICLE_MAKES = [
  { code: 'hino', name: 'Hino', country: 'Japan', isPopular: true, isFallback: true },
  { code: 'isuzu', name: 'Isuzu', country: 'Japan', isPopular: true, isFallback: true },
  { code: 'toyota', name: 'Toyota', country: 'Japan', isPopular: true, isFallback: true },
  { code: 'nissan', name: 'Nissan', country: 'Japan', isPopular: true, isFallback: true },
  { code: 'mitsubishi-fuso', name: 'Mitsubishi Fuso', country: 'Japan', isPopular: true, isFallback: true },
  { code: 'mercedes-benz', name: 'Mercedes-Benz', country: 'Germany', isPopular: true, isFallback: true },
  { code: 'man', name: 'MAN', country: 'Germany', isPopular: true, isFallback: true },
  { code: 'scania', name: 'Scania', country: 'Sweden', isPopular: true, isFallback: true },
  { code: 'volvo', name: 'Volvo', country: 'Sweden', isPopular: true, isFallback: true },
  { code: 'other', name: 'Other', country: '', isPopular: false, isFallback: true }
];

const DEFAULT_TRAILER_TYPES = [
  {
    code: 'flatbed',
    name: 'Flatbed Trailer',
    category: 'flatbed',
    description: 'Open flatbed trailer for general cargo and oversized loads',
    capacityRange: { min: 20, max: 34, unit: 'tonnes' },
    isFallback: true
  },
  {
    code: 'tautliner',
    name: 'Tautliner / Curtain Side',
    category: 'enclosed',
    description: 'Curtain-side trailer for protected freight',
    capacityRange: { min: 20, max: 30, unit: 'tonnes' },
    isFallback: true
  },
  {
    code: 'refrigerated',
    name: 'Refrigerated Trailer',
    category: 'refrigerated',
    description: 'Temperature-controlled trailer for cold-chain cargo',
    capacityRange: { min: 18, max: 28, unit: 'tonnes' },
    isFallback: true
  },
  {
    code: 'tanker',
    name: 'Tanker Trailer',
    category: 'tanker',
    description: 'Tanker trailer for liquid cargo',
    capacityRange: { min: 20000, max: 36000, unit: 'liters' },
    isFallback: true
  }
];

const AddVehicleScreen = () => {
  const navigation = useNavigation();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);

  // Reference data from API
  const [vehicleTypes, setVehicleTypes] = useState([]);
  const [vehicleMakes, setVehicleMakes] = useState([]);
  const [vehicleModels, setVehicleModels] = useState([]);
  const [trailerTypes, setTrailerTypes] = useState([]);

  // Selection modals
  const [showMakeModal, setShowMakeModal] = useState(false);
  const [showModelModal, setShowModelModal] = useState(false);
  const [selectedMake, setSelectedMake] = useState(null);
  const [selectedModel, setSelectedModel] = useState(null);
  const [selectedVehicleType, setSelectedVehicleType] = useState(null);

  // Vehicle photos
  const [photos, setPhotos] = useState({
    front: null,
    back: null,
    left: null,
    right: null,
    interior: null,
    cargo: null
  });
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [currentPhotoType, setCurrentPhotoType] = useState(null);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);

  const PHOTO_TYPES = [
    { key: 'front', label: 'Front View', icon: 'directions-car', required: true },
    { key: 'back', label: 'Rear View', icon: 'directions-car', required: true },
    { key: 'left', label: 'Left Side', icon: 'directions-car', required: false },
    { key: 'right', label: 'Right Side', icon: 'directions-car', required: false },
    { key: 'interior', label: 'Interior/Cabin', icon: 'airline-seat-recline-normal', required: false },
    { key: 'cargo', label: 'Cargo Area', icon: 'inventory-2', required: true }
  ];

  const [vehicleData, setVehicleData] = useState({
    // Basic Information
    category: '',
    subType: '',
    hasTrailer: null,
    trailerType: '',
    trailerOwned: null,
    
    // Vehicle Details
    registrationNumber: '',
    make: '',
    model: '',
    year: '',
    color: '',
    
    // Capacity
    capacity: {
      weight: {
        value: '',
        unit: 'tonnes'
      }
    },
    
    // Specifications
    specifications: {
      engineType: 'diesel',
      transmission: 'manual',
      fuelCapacity: '',
      mileage: ''
    },
    
    // Features
    features: {
      gps: false,
      refrigeration: false,
      liftGate: false,
      loadingRamp: false,
      airRide: false,
      tarpaulin: false,
      secureStorage: false
    },
    specialFeatures: [],
    
    // Rental Settings
    pricing: {
      availableForRental: false,
      dailyRate: '',
      weeklyRate: '',
      monthlyRate: '',
      deposit: '',
      minimumRentalPeriod: {
        value: '1',
        unit: 'days'
      }
    },
    
    // Operating Areas
    operatingAreas: [],
    
    description: ''
  });

  // Fetch reference data on mount
  useEffect(() => {
    fetchReferenceData();
  }, []);

  // Fetch models when make is selected
  useEffect(() => {
    if (selectedMake && isObjectId(selectedMake._id)) {
      fetchModelsForMake(selectedMake._id);
    } else if (selectedMake) {
      setVehicleModels([]);
    }
  }, [selectedMake]);

  const fetchReferenceData = async () => {
    setDataLoading(true);
    try {
      const response = await apiService.request('/reference/all');
      if (response.success) {
        const referenceData = response.data || {};
        const nextVehicleTypes = Array.isArray(referenceData.vehicleTypes) && referenceData.vehicleTypes.length
          ? referenceData.vehicleTypes
          : DEFAULT_VEHICLE_TYPES;
        const nextVehicleMakes = Array.isArray(referenceData.vehicleMakes) && referenceData.vehicleMakes.length
          ? referenceData.vehicleMakes
          : DEFAULT_VEHICLE_MAKES;
        const nextTrailerTypes = Array.isArray(referenceData.trailerTypes) && referenceData.trailerTypes.length
          ? referenceData.trailerTypes
          : DEFAULT_TRAILER_TYPES;

        setVehicleTypes(nextVehicleTypes);
        setVehicleMakes(nextVehicleMakes);
        setTrailerTypes(nextTrailerTypes);
      } else {
        setVehicleTypes(DEFAULT_VEHICLE_TYPES);
        setVehicleMakes(DEFAULT_VEHICLE_MAKES);
        setTrailerTypes(DEFAULT_TRAILER_TYPES);
      }
    } catch (error) {
      console.error('Failed to fetch reference data:', error);
      setVehicleTypes(DEFAULT_VEHICLE_TYPES);
      setVehicleMakes(DEFAULT_VEHICLE_MAKES);
      setTrailerTypes(DEFAULT_TRAILER_TYPES);
      Alert.alert('Vehicle data loaded', 'We could not reach the reference list, so default vehicle options are being used.');
    } finally {
      setDataLoading(false);
    }
  };

  const fetchModelsForMake = async (makeId) => {
    try {
      const response = await apiService.request(`/reference/vehicle-makes/${makeId}/models`);
      if (response.success) {
        setVehicleModels(response.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch models:', error);
    }
  };

  // Group vehicle types by category
  const groupedVehicleTypes = vehicleTypes.reduce((acc, type) => {
    if (!acc[type.category]) {
      acc[type.category] = [];
    }
    acc[type.category].push(type);
    return acc;
  }, {});

  const categories = [
    { value: 'bakkie', label: 'Bakkie / Van', icon: '🚐', description: 'Light delivery vehicles' },
    { value: 'van', label: 'Delivery Van', icon: '🚐', description: 'Panel and cargo vans' },
    { value: 'truck', label: 'Truck', icon: '🚚', description: 'Standard cargo trucks' },
    { value: 'tractor', label: 'Truck Tractor', icon: '🚛', description: 'With or without trailer' }
  ];

  const specialFeatures = [
    'Tarpaulin Cover',
    'Hydraulic Tailgate',
    'Side Loading',
    'GPS Tracking',
    'Refrigeration',
    'Securing Straps',
    'Pallet Jack',
    'Temperature Monitoring'
  ];

  const updateField = (path, value) => {
    setVehicleData(prev => {
      const keys = path.split('.');
      const lastKey = keys.pop();
      const lastObj = keys.reduce((obj, key) => obj[key] || {}, prev);
      lastObj[lastKey] = value;
      return { ...prev };
    });
  };

  const toggleFeature = (feature) => {
    setVehicleData(prev => ({
      ...prev,
      specialFeatures: prev.specialFeatures.includes(feature)
        ? prev.specialFeatures.filter(f => f !== feature)
        : [...prev.specialFeatures, feature]
    }));
  };

  // Photo handling functions
  const openPhotoOptions = (photoType) => {
    setCurrentPhotoType(photoType);
    setShowPhotoModal(true);
  };

  const handleTakePhoto = async () => {
    setShowPhotoModal(false);

    const options = {
      mediaType: 'photo',
      quality: 0.8,
      maxWidth: 1200,
      maxHeight: 1200,
      saveToPhotos: false
    };

    try {
      const result = await launchCamera(options);
      if (result.assets && result.assets[0]) {
        setPhotos(prev => ({
          ...prev,
          [currentPhotoType]: result.assets[0]
        }));
      }
    } catch (error) {
      console.error('Camera error:', error);
      Alert.alert('Error', 'Failed to open camera');
    }
  };

  const handleChooseFromGallery = async () => {
    setShowPhotoModal(false);

    const options = {
      mediaType: 'photo',
      quality: 0.8,
      maxWidth: 1200,
      maxHeight: 1200
    };

    try {
      const result = await launchImageLibrary(options);
      if (result.assets && result.assets[0]) {
        setPhotos(prev => ({
          ...prev,
          [currentPhotoType]: result.assets[0]
        }));
      }
    } catch (error) {
      console.error('Gallery error:', error);
      Alert.alert('Error', 'Failed to open gallery');
    }
  };

  const removePhoto = (photoType) => {
    setPhotos(prev => ({
      ...prev,
      [photoType]: null
    }));
  };

  const getPhotoCount = () => {
    return Object.values(photos).filter(p => p !== null).length;
  };

  const getRequiredPhotosCount = () => {
    return PHOTO_TYPES.filter(p => p.required && photos[p.key]).length;
  };

  const validatePhotos = () => {
    const missingRequired = PHOTO_TYPES
      .filter(p => p.required && !photos[p.key])
      .map(p => p.label);

    if (missingRequired.length > 0) {
      Alert.alert(
        'Missing Photos',
        `Please add the following required photos:\n${missingRequired.join('\n')}`
      );
      return false;
    }
    return true;
  };

  const handleCategorySelect = (category) => {
    updateField('category', category);
    setStep(2);
  };

  const handleTypeSelect = (type) => {
    updateField('subType', type);
    
    // Set default capacity based on type
    if (vehicleData.category === 'tractor' && vehicleData.hasTrailer) {
      updateField('capacity.weight.value', '15');
    } else {
      const capacityMap = {
        'single_cab': '1.5', 'double_cab': '2', 'panel_van': '2', 'delivery_van': '3',
        '3ton': '3', '5ton': '5', '7ton': '7', '10ton': '10', '15ton': '15'
      };
      updateField('capacity.weight.value', capacityMap[type] || '');
    }
    
    setStep(4);
  };

  const validateStep = (step) => {
    switch (step) {
      case 4:
        return vehicleData.registrationNumber && vehicleData.make && vehicleData.model && 
               vehicleData.year && vehicleData.capacity.weight.value;
      default:
        return true;
    }
  };

  const uploadPhotos = async (vehicleId) => {
    const photoEntries = Object.entries(photos).filter(([_, photo]) => photo !== null);

    if (photoEntries.length === 0) return [];

    const uploadedPhotos = [];

    for (const [type, photo] of photoEntries) {
      try {
        const formData = new FormData();
        formData.append('photo', {
          uri: Platform.OS === 'android' ? photo.uri : photo.uri.replace('file://', ''),
          type: photo.type || 'image/jpeg',
          name: photo.fileName || `${type}_${Date.now()}.jpg`
        });
        formData.append('photoType', type);
        formData.append('vehicleId', vehicleId);

        const response = await apiService.uploadVehiclePhoto(vehicleId, formData);
        if (response.success) {
          uploadedPhotos.push({ type, url: response.data.url });
        }
      } catch (error) {
        console.error(`Failed to upload ${type} photo:`, error);
      }
    }

    return uploadedPhotos;
  };

  const buildVehiclePayload = () => {
    const payload = {
      ...vehicleData,
      capacity: {
        ...vehicleData.capacity,
        weight: {
          ...vehicleData.capacity.weight,
          value: Number(vehicleData.capacity.weight.value || 0)
        }
      },
      year: Number(vehicleData.year || 0)
    };

    ['trailerType', 'makeId', 'modelId'].forEach((field) => {
      if (payload[field] === '') delete payload[field];
    });

    if (!payload.trailerType || !isObjectId(payload.trailerType)) {
      delete payload.trailerType;
    }

    if (selectedMake) {
      payload.make = isObjectId(selectedMake._id) ? selectedMake._id : selectedMake.name;
      payload.makeName = selectedMake.name;
    }

    if (selectedModel) {
      payload.model = isObjectId(selectedModel._id) ? selectedModel._id : selectedModel.name;
      payload.modelName = selectedModel.name;
    }

    return payload;
  };

  const handleSubmit = async () => {
    if (!validateStep(4)) {
      Alert.alert('Validation Error', 'Please fill in all required fields');
      return;
    }

    // Validate required photos
    if (!validatePhotos()) {
      return;
    }

    setLoading(true);
    try {
      // First create the vehicle
      const response = await apiService.createVehicle(buildVehiclePayload());

      if (response.success) {
        const vehicleId = response.data._id || response.data.vehicle?._id;

        // Then upload photos
        if (vehicleId && getPhotoCount() > 0) {
          setUploadingPhotos(true);
          await uploadPhotos(vehicleId);
          setUploadingPhotos(false);
        }

        Alert.alert('Vehicle saved', response.message || 'Vehicle added successfully', [
          { text: 'OK', onPress: () => navigation.navigate('FleetDashboard') }
        ]);
      } else {
        Alert.alert('Error', response.message || 'Failed to add vehicle');
      }
    } catch (error) {
      console.error('Add vehicle error:', error);
      Alert.alert('Error', error.message || 'Failed to add vehicle. Please try again.');
    } finally {
      setLoading(false);
      setUploadingPhotos(false);
    }
  };



  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Vehicle Category</Text>
      <View style={styles.optionsGrid}>
        {categories.map((cat) => (
          <TouchableOpacity
            key={cat.value}
            style={styles.optionCard}
            onPress={() => handleCategorySelect(cat.value)}
          >
            <Text style={styles.optionIcon}>{cat.icon}</Text>
            <Text style={styles.optionTitle}>{cat.label}</Text>
            <Text style={styles.optionDescription}>{cat.description}</Text>
            <MaterialIcons name="chevron-right" size={20} color="#6b7280" />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderStep2 = () => {
    const categoryTypes = groupedVehicleTypes[vehicleData.category] || [];

    return (
      <ScrollView style={styles.stepContainer}>
        <Text style={styles.stepTitle}>
          {vehicleData.category === 'tractor' ? 'Truck Tractor Setup' :
           vehicleData.category === 'bakkie' ? 'Bakkie/Van Type' :
           vehicleData.category === 'van' ? 'Van Type' : 'Truck Type'}
        </Text>

        {vehicleData.category === 'tractor' ? (
          <View style={styles.optionsGrid}>
            <TouchableOpacity
              style={styles.optionCard}
              onPress={() => {
                updateField('hasTrailer', true);
                setStep(3);
              }}
            >
              <Text style={styles.optionIcon}>🚛</Text>
              <Text style={styles.optionTitle}>With Trailer</Text>
              <Text style={styles.optionDescription}>Truck tractor with trailer attached</Text>
              <MaterialIcons name="chevron-right" size={20} color="#6b7280" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.optionCard}
              onPress={() => {
                updateField('hasTrailer', false);
                setStep(4);
              }}
            >
              <Text style={styles.optionIcon}>🚜</Text>
              <Text style={styles.optionTitle}>Tractor Only</Text>
              <Text style={styles.optionDescription}>Can rent/borrow trailer when needed</Text>
              <MaterialIcons name="chevron-right" size={20} color="#6b7280" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.optionsGrid}>
            {categoryTypes.length > 0 ? (
              categoryTypes.map((type) => (
                <TouchableOpacity
                  key={referenceKey(type, 'vehicle-type')}
                  style={[
                    styles.optionCard,
                    selectedVehicleType?._id === type._id && styles.optionCardSelected
                  ]}
                  onPress={() => {
                    setSelectedVehicleType(type);
                    updateField('subType', type.name);
                    updateField('vehicleType', isObjectId(type._id) ? type._id : '');
                    updateField('vehicleTypeName', type.name);
                    updateField('vehicleTypeCode', type.code || type.subcategory || '');
                    // Set capacity from type
                    if (type.capacity?.weight?.max) {
                      updateField('capacity.weight.value', type.capacity.weight.max.toString());
                      updateField('capacity.weight.unit', type.capacity.weight.unit || 'tonnes');
                    }
                    setStep(4);
                  }}
                >
                  <View style={styles.optionContent}>
                    <Text style={styles.optionTitle}>{type.name}</Text>
                    <Text style={styles.optionDescription}>
                      {type.description || `Capacity: ${type.capacity?.weight?.max || 'N/A'} ${type.capacity?.weight?.unit || 'tonnes'}`}
                    </Text>
                    {type.specialCapabilities?.length > 0 && (
                      <Text style={styles.optionCapabilities}>
                        {type.specialCapabilities.slice(0, 3).join(', ')}
                      </Text>
                    )}
                  </View>
                  <MaterialIcons name="chevron-right" size={20} color="#6b7280" />
                </TouchableOpacity>
              ))
            ) : (
              <Text style={styles.noDataText}>
                No vehicle types are available for this category yet. Go back and choose another category, or refresh the app.
              </Text>
            )}
          </View>
        )}
      </ScrollView>
    );
  };

  const renderStep3 = () => (
    <ScrollView style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Trailer Type</Text>
      <View style={styles.optionsGrid}>
        {trailerTypes.length > 0 ? (
          trailerTypes.map((trailer) => (
            <TouchableOpacity
              key={referenceKey(trailer, 'trailer-type')}
              style={styles.optionCard}
              onPress={() => {
                updateField('trailerType', isObjectId(trailer._id) ? trailer._id : trailer.name);
                updateField('trailerTypeName', trailer.name);
                updateField('trailerCategory', trailer.category || 'flatbed');
                setStep(4);
              }}
            >
              <View style={styles.optionContent}>
                <Text style={styles.optionTitle}>{trailer.name}</Text>
                <Text style={styles.optionDescription}>
                  {trailer.description || `${trailer.category} trailer`}
                </Text>
                {trailer.capacityRange && (
                  <Text style={styles.optionCapacity}>
                    Capacity: {trailer.capacityRange.min}-{trailer.capacityRange.max} {trailer.capacityRange.unit}
                  </Text>
                )}
              </View>
              <MaterialIcons name="chevron-right" size={20} color="#6b7280" />
            </TouchableOpacity>
          ))
        ) : (
          <Text style={styles.noDataText}>No trailer types are available yet. Please refresh or continue with tractor only.</Text>
        )}
      </View>
    </ScrollView>
  );

  const renderStep4 = () => (
    <ScrollView style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Vehicle Details</Text>

      <View style={styles.form}>
        {/* Registration Number */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Registration Number *</Text>
          <TextInput
            style={styles.input}
            value={vehicleData.registrationNumber}
            onChangeText={(value) => updateField('registrationNumber', value)}
            placeholder="ABC 1234"
          />
        </View>

        {/* Make Selection */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Make *</Text>
          <TouchableOpacity
            style={styles.selectInput}
            onPress={() => setShowMakeModal(true)}
          >
            <Text style={selectedMake ? styles.selectInputText : styles.selectInputPlaceholder}>
              {selectedMake?.name || 'Select vehicle make...'}
            </Text>
            <MaterialIcons name="arrow-drop-down" size={24} color="#6b7280" />
          </TouchableOpacity>
        </View>

        {/* Model Selection */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Model *</Text>
          <TouchableOpacity
            style={[styles.selectInput, !selectedMake && styles.selectInputDisabled]}
            onPress={() => selectedMake && setShowModelModal(true)}
            disabled={!selectedMake}
          >
            <Text style={selectedModel ? styles.selectInputText : styles.selectInputPlaceholder}>
              {selectedModel?.name || vehicleData.model || (selectedMake ? 'Select model...' : 'Select make first')}
            </Text>
            <MaterialIcons name="arrow-drop-down" size={24} color="#6b7280" />
          </TouchableOpacity>
          {selectedMake && vehicleModels.length === 0 && (
            <TextInput
              style={[styles.input, { marginTop: 8 }]}
              value={vehicleData.model}
              onChangeText={(value) => {
                updateField('model', value);
                updateField('modelName', value);
              }}
              placeholder="Enter model name manually"
            />
          )}
        </View>

        {/* Year and Capacity */}
        <View style={styles.row}>
          <View style={[styles.inputGroup, styles.flex]}>
            <Text style={styles.label}>Year *</Text>
            <TextInput
              style={styles.input}
              value={vehicleData.year}
              onChangeText={(value) => updateField('year', value)}
              placeholder="2020"
              keyboardType="numeric"
            />
          </View>
          <View style={[styles.inputGroup, styles.flex]}>
            <Text style={styles.label}>Capacity (tonnes) *</Text>
            <TextInput
              style={styles.input}
              value={vehicleData.capacity.weight.value}
              onChangeText={(value) => updateField('capacity.weight.value', value)}
              placeholder="7"
              keyboardType="numeric"
            />
          </View>
        </View>

        {/* Color */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Color</Text>
          <TextInput
            style={styles.input}
            value={vehicleData.color}
            onChangeText={(value) => updateField('color', value)}
            placeholder="White"
          />
        </View>

        {/* Special Features */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Special Features</Text>
          <View style={styles.featuresGrid}>
            {specialFeatures.map((feature) => (
              <TouchableOpacity
                key={feature}
                style={[
                  styles.featureButton,
                  vehicleData.specialFeatures.includes(feature) && styles.featureButtonSelected
                ]}
                onPress={() => toggleFeature(feature)}
              >
                <Text style={[
                  styles.featureText,
                  vehicleData.specialFeatures.includes(feature) && styles.featureTextSelected
                ]}>
                  {vehicleData.specialFeatures.includes(feature) ? '✓ ' : ''}{feature}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Rental Availability */}
        <View style={styles.inputGroup}>
          <View style={styles.switchContainer}>
            <Text style={styles.label}>Make Available for Rental</Text>
            <Switch
              value={vehicleData.pricing.availableForRental}
              onValueChange={(value) => updateField('pricing.availableForRental', value)}
              trackColor={{ false: '#767577', true: '#0C2D48' }}
              thumbColor={vehicleData.pricing.availableForRental ? '#F37021' : '#f4f3f4'}
            />
          </View>
        </View>

        {vehicleData.pricing.availableForRental && (
          <>
            <Text style={styles.sectionTitle}>Rental Pricing</Text>
            
            <View style={styles.row}>
              <View style={[styles.inputGroup, styles.flex]}>
                <Text style={styles.label}>Daily Rate ($)</Text>
                <TextInput
                  style={styles.input}
                  value={vehicleData.pricing.dailyRate}
                  onChangeText={(value) => updateField('pricing.dailyRate', value)}
                  placeholder="80"
                  keyboardType="numeric"
                />
              </View>
              <View style={[styles.inputGroup, styles.flex]}>
                <Text style={styles.label}>Weekly Rate ($)</Text>
                <TextInput
                  style={styles.input}
                  value={vehicleData.pricing.weeklyRate}
                  onChangeText={(value) => updateField('pricing.weeklyRate', value)}
                  placeholder="500"
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Monthly Rate ($)</Text>
              <TextInput
                style={styles.input}
                value={vehicleData.pricing.monthlyRate}
                onChangeText={(value) => updateField('pricing.monthlyRate', value)}
                placeholder="1800"
                keyboardType="numeric"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Security Deposit ($)</Text>
              <TextInput
                style={styles.input}
                value={vehicleData.pricing.deposit}
                onChangeText={(value) => updateField('pricing.deposit', value)}
                placeholder="200"
                keyboardType="numeric"
              />
            </View>
          </>
        )}

        {/* Description */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={vehicleData.description}
            onChangeText={(value) => updateField('description', value)}
            placeholder="Additional details about the vehicle..."
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        {/* Vehicle Photos Section */}
        <View style={styles.photosSection}>
          <View style={styles.photosSectionHeader}>
            <Text style={styles.sectionTitle}>Vehicle Photos</Text>
            <Text style={styles.photoCount}>
              {getPhotoCount()}/6 photos ({getRequiredPhotosCount()}/3 required)
            </Text>
          </View>
          <Text style={styles.photosHint}>
            Add clear photos of your vehicle. Required photos are marked with *
          </Text>

          <View style={styles.photosGrid}>
            {PHOTO_TYPES.map((photoType) => (
              <TouchableOpacity
                key={photoType.key}
                style={[
                  styles.photoCard,
                  photos[photoType.key] && styles.photoCardFilled
                ]}
                onPress={() => openPhotoOptions(photoType.key)}
              >
                {photos[photoType.key] ? (
                  <View style={styles.photoPreviewContainer}>
                    <Image
                      source={{ uri: photos[photoType.key].uri }}
                      style={styles.photoPreview}
                      resizeMode="cover"
                    />
                    <TouchableOpacity
                      style={styles.removePhotoButton}
                      onPress={() => removePhoto(photoType.key)}
                    >
                      <MaterialIcons name="close" size={16} color="white" />
                    </TouchableOpacity>
                    <View style={styles.photoLabelOverlay}>
                      <Text style={styles.photoLabelText}>{photoType.label}</Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <MaterialIcons name={photoType.icon} size={32} color="#9ca3af" />
                    <Text style={styles.photoPlaceholderText}>
                      {photoType.label}{photoType.required ? ' *' : ''}
                    </Text>
                    <MaterialIcons name="add-a-photo" size={20} color="#6b7280" />
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.submitButton, (loading || uploadingPhotos) && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={loading || uploadingPhotos}
      >
        {uploadingPhotos ? (
          <View style={styles.uploadingContainer}>
            <ActivityIndicator color="white" size="small" />
            <Text style={styles.submitButtonText}>Uploading Photos...</Text>
          </View>
        ) : (
          <Text style={styles.submitButtonText}>
            {loading ? 'Adding Vehicle...' : 'Add Vehicle'}
          </Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => step > 1 ? setStep(step - 1) : navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={24} color="white" />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        
        <View>
          <Text style={styles.headerTitle}>Add Vehicle</Text>
          <Text style={styles.headerSubtitle}>Step {step} of 4</Text>
        </View>

        <View style={styles.progressBar}>
          {[1, 2, 3, 4].map(s => (
            <View
              key={s}
              style={[
                styles.progressStep,
                s <= step && styles.progressStepActive
              ]}
            />
          ))}
        </View>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {dataLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#0C2D48" />
            <Text style={styles.loadingText}>Loading vehicle data...</Text>
          </View>
        ) : (
          <>
            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && renderStep3()}
            {step === 4 && renderStep4()}
          </>
        )}
      </View>

      {/* Make Selection Modal */}
      <Modal
        visible={showMakeModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowMakeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Vehicle Make</Text>
              <TouchableOpacity onPress={() => setShowMakeModal(false)}>
                <MaterialIcons name="close" size={24} color="#374151" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={vehicleMakes}
              keyExtractor={(item) => referenceKey(item, 'make')}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.modalItem,
                    selectedMake?._id === item._id && styles.modalItemSelected
                  ]}
                  onPress={() => {
                    setSelectedMake(item);
                    setSelectedModel(null);
                    updateField('make', item.name);
                    updateField('makeName', item.name);
                    updateField('makeId', isObjectId(item._id) ? item._id : '');
                    updateField('model', '');
                    updateField('modelName', '');
                    setShowMakeModal(false);
                  }}
                >
                  <View>
                    <Text style={styles.modalItemText}>{item.name}</Text>
                    {item.country && (
                      <Text style={styles.modalItemSubtext}>{item.country}</Text>
                    )}
                  </View>
                  {item.isPopular && (
                    <View style={styles.popularBadge}>
                      <Text style={styles.popularBadgeText}>Popular</Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.noDataText}>No vehicle makes available</Text>
              }
            />
          </View>
        </View>
      </Modal>

      {/* Model Selection Modal */}
      <Modal
        visible={showModelModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowModelModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Model</Text>
              <TouchableOpacity onPress={() => setShowModelModal(false)}>
                <MaterialIcons name="close" size={24} color="#374151" />
              </TouchableOpacity>
            </View>
            {vehicleModels.length > 0 ? (
              <FlatList
                data={vehicleModels}
                keyExtractor={(item) => referenceKey(item, 'model')}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.modalItem,
                      selectedModel?._id === item._id && styles.modalItemSelected
                    ]}
                    onPress={() => {
                      setSelectedModel(item);
                      updateField('model', isObjectId(item._id) ? item._id : item.name);
                      updateField('modelName', item.name);
                      updateField('modelId', isObjectId(item._id) ? item._id : '');
                      setShowModelModal(false);
                    }}
                  >
                    <Text style={styles.modalItemText}>{item.name}</Text>
                  </TouchableOpacity>
                )}
              />
            ) : (
              <View style={styles.noModelsContainer}>
                <Text style={styles.noDataText}>
                  No pre-defined models for {selectedMake?.name}.
                </Text>
                <Text style={styles.noDataSubtext}>
                  Please enter the model name manually.
                </Text>
                <TouchableOpacity
                  style={styles.closeModalButton}
                  onPress={() => setShowModelModal(false)}
                >
                  <Text style={styles.closeModalButtonText}>Close</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Photo Selection Modal */}
      <Modal
        visible={showPhotoModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPhotoModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.photoModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Photo</Text>
              <TouchableOpacity onPress={() => setShowPhotoModal(false)}>
                <MaterialIcons name="close" size={24} color="#374151" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.photoOptionButton}
              onPress={handleTakePhoto}
            >
              <MaterialIcons name="camera-alt" size={28} color="#0C2D48" />
              <View style={styles.photoOptionText}>
                <Text style={styles.photoOptionTitle}>Take Photo</Text>
                <Text style={styles.photoOptionSubtitle}>Use your camera</Text>
              </View>
              <MaterialIcons name="chevron-right" size={24} color="#9ca3af" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.photoOptionButton}
              onPress={handleChooseFromGallery}
            >
              <MaterialIcons name="photo-library" size={28} color="#0C2D48" />
              <View style={styles.photoOptionText}>
                <Text style={styles.photoOptionTitle}>Choose from Gallery</Text>
                <Text style={styles.photoOptionSubtitle}>Select existing photo</Text>
              </View>
              <MaterialIcons name="chevron-right" size={24} color="#9ca3af" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowPhotoModal(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    backgroundColor: '#0C2D48',
    padding: 20,
    paddingTop: 50,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
    marginLeft: 8,
  },
  headerTitle: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  headerSubtitle: {
    color: 'white',
    fontSize: 14,
    opacity: 0.8,
    marginBottom: 16,
  },
  progressBar: {
    flexDirection: 'row',
    gap: 4,
  },
  progressStep: {
    flex: 1,
    height: 4,
    backgroundColor: '#1e4d7a',
    borderRadius: 2,
  },
  progressStepActive: {
    backgroundColor: '#60a5fa',
  },
  content: {
    flex: 1,
  },
  stepContainer: {
    flex: 1,
    padding: 20,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 20,
  },
  optionsGrid: {
    gap: 12,
    paddingBottom: 20, // Add padding to ensure content doesn't get cut off
  },
  optionCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    flex: 1,
  },
  optionDescription: {
    fontSize: 14,
    color: '#6b7280',
    flex: 2,
  },
  form: {
    gap: 16,
    paddingBottom: 20, // Add padding for the submit button
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  input: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  flex: {
    flex: 1,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  featureButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 8,
  },
  featureButtonSelected: {
    backgroundColor: '#0C2D48',
    borderColor: '#0C2D48',
  },
  featureText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  featureTextSelected: {
    color: 'white',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginTop: 8,
    marginBottom: 12,
  },
  submitButton: {
    backgroundColor: '#0C2D48',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40, // Extra margin for better scrolling
  },
  submitButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  // New styles for DB-driven selection
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280',
  },
  optionContent: {
    flex: 1,
  },
  optionCardSelected: {
    borderColor: '#0C2D48',
    backgroundColor: '#f0f9ff',
  },
  optionCapabilities: {
    fontSize: 12,
    color: '#0C2D48',
    marginTop: 4,
    fontStyle: 'italic',
  },
  optionCapacity: {
    fontSize: 12,
    color: '#059669',
    marginTop: 4,
  },
  noDataText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    padding: 20,
  },
  noDataSubtext: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 4,
  },
  selectInput: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectInputDisabled: {
    backgroundColor: '#f3f4f6',
  },
  selectInputText: {
    fontSize: 16,
    color: '#1f2937',
  },
  selectInputPlaceholder: {
    fontSize: 16,
    color: '#9ca3af',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  modalItemSelected: {
    backgroundColor: '#f0f9ff',
  },
  modalItemText: {
    fontSize: 16,
    color: '#1f2937',
  },
  modalItemSubtext: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  popularBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  popularBadgeText: {
    fontSize: 10,
    color: '#d97706',
    fontWeight: '600',
  },
  noModelsContainer: {
    padding: 20,
    alignItems: 'center',
  },
  closeModalButton: {
    marginTop: 16,
    backgroundColor: '#0C2D48',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  closeModalButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  // Photo styles
  photosSection: {
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  photosSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  photoCount: {
    fontSize: 12,
    color: '#6b7280',
  },
  photosHint: {
    fontSize: 13,
    color: '#9ca3af',
    marginBottom: 16,
  },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  photoCard: {
    width: '47%',
    aspectRatio: 4 / 3,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
    overflow: 'hidden',
  },
  photoCardFilled: {
    borderStyle: 'solid',
    borderColor: '#10b981',
  },
  photoPreviewContainer: {
    flex: 1,
    position: 'relative',
  },
  photoPreview: {
    width: '100%',
    height: '100%',
  },
  removePhotoButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoLabelOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  photoLabelText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '500',
  },
  photoPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },
  photoPlaceholderText: {
    fontSize: 11,
    color: '#6b7280',
    textAlign: 'center',
    marginVertical: 4,
  },
  uploadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  photoModalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
  },
  photoOptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    gap: 12,
  },
  photoOptionText: {
    flex: 1,
  },
  photoOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  photoOptionSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  cancelButton: {
    margin: 16,
    padding: 14,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
});

export default AddVehicleScreen;
